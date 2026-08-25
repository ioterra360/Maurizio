import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";
import { reportError } from "./report-error";
import {
  authLinkErrorMessage,
  authLinkFingerprint,
  classifyAuthLink,
  parseAuthLink,
  type AuthLink,
} from "./auth-links";

export type UserRole = "user" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  hydrated: boolean;
  /**
   * True between a successful signup and onboarding completion. The auth
   * gate skips its signed-in redirect while this is set so the brand-new
   * user actually sees the onboarding carousel instead of being yanked
   * straight to Today.
   */
  pendingOnboarding: boolean;
  setPendingOnboarding: (pending: boolean) => void;
  /**
   * True while a password-recovery link is being handled: from the moment
   * the app receives `memika://reset-password#…` until the user saves a new
   * password (or gives up). The auth gate keeps the user inside the (auth)
   * stack while it is set — the recovery tokens create a REAL session, and
   * without this flag the SIGNED_IN they emit would bounce the user to
   * Today before they ever see the "Nuova password" form.
   */
  pendingPasswordReset: boolean;
  /**
   * The last auth deep link the app received (recovery / signup
   * confirmation). The target screen consumes it via `applyAuthLink`.
   * Memory-only on purpose: it carries bearer tokens.
   */
  authLink: AuthLink | null;
  /**
   * Feeds an incoming URL (initial URL or `url` event) through the auth-link
   * parser. Returns what happened so the caller can log it; non-auth URLs
   * are ignored, an already-consumed link is skipped (Expo Go reloads
   * re-deliver the same initial URL).
   */
  receiveAuthLink: (url: string) => Promise<"ignored" | "duplicate" | "queued">;
  /**
   * Turns the tokens (implicit flow) or the PKCE code carried by a link into
   * a Supabase session. Resolves with a user-facing Italian error message
   * on failure, null on success.
   */
  applyAuthLink: (link: AuthLink) => Promise<string | null>;
  /** `supabase.auth.updateUser({ password })`. Throws the raw error. */
  updatePassword: (password: string) => Promise<void>;
  /** Clears the recovery flag + link (after success, cancel or sign-out). */
  endPasswordReset: () => void;
  /**
   * Admin-only escape hatch: when true the auth gate lets an admin use the
   * consumer `(app)` surface (Today, Cartelle, Progressi, Impostazioni)
   * instead of bouncing them to the admin shell. Memory-only on purpose —
   * a reload lands the admin back on the admin home. Cleared on sign-out.
   */
  viewAsUser: boolean;
  setViewAsUser: (on: boolean) => void;
  /** Updates the cached user name after a successful profile save. */
  setUserName: (name: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Subscribes to Supabase auth events. Returns an unsubscribe fn. */
  subscribeAuthChanges: () => () => void;
};

const DEMO_STORAGE_KEY = "memika.demo-auth";
/** Fingerprint of the last auth link we acted on — see receiveAuthLink. */
const AUTH_LINK_SEEN_KEY = "memika.auth-link.seen";

/**
 * Single source of truth for the two demo accounts used during development.
 * In real Supabase mode these are nothing special — the trigger creates
 * profiles like any other signup, and admin is granted via the
 * `admin_emails` allowlist on the database.
 */
export const DEMO_ACCOUNTS = [
  {
    email: "angelo.casula@gmail.com",
    name: "Angelo Casula",
    role: "user" as const,
    initials: "AC",
  },
  {
    email: "maurizio.cocco@memika.app",
    name: "Maurizio Cocco",
    role: "admin" as const,
    initials: "MC",
  },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

function deriveName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return cleaned || "Memika user";
}

function safeMetaName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as { name?: unknown; full_name?: unknown };
  if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
  if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  return null;
}

async function buildAuthUserFromSession(
  session: { user: { id: string; email?: string; user_metadata?: unknown } } | null,
): Promise<AuthUser | null> {
  if (!session?.user) return null;
  const u = session.user;
  const email = (u.email ?? "").toLowerCase();

  // CRITICAL: role MUST come from the database (profiles.role), NEVER inferred
  // from the email. The handle_new_user trigger + admin_emails allowlist are
  // the only authorities on who is admin.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", u.id)
    .maybeSingle();

  if (error) reportError("auth/profile-lookup", error);

  const role: UserRole = profile?.role === "admin" ? "admin" : "user";
  const name =
    (typeof profile?.name === "string" && profile.name) ||
    safeMetaName(u.user_metadata) ||
    deriveName(email);

  return { id: u.id, email, name, role };
}

/**
 * Monotonic guard against stale async completions. Every auth transition
 * bumps the epoch; any in-flight profile fetch captured under an older
 * epoch discards its result instead of resurrecting a signed-out user.
 */
let authEpoch = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  hydrated: false,
  pendingOnboarding: false,
  pendingPasswordReset: false,
  authLink: null,
  viewAsUser: false,

  setPendingOnboarding: (pending) => set({ pendingOnboarding: pending }),
  setViewAsUser: (on) => set({ viewAsUser: on }),

  receiveAuthLink: async (url) => {
    if (!isSupabaseConfigured) return "ignored";
    const link = parseAuthLink(url);
    const action = classifyAuthLink(link);
    if (action.kind === "ignore") return "ignored";

    const fingerprint = authLinkFingerprint(url);
    const seen = await AsyncStorage.getItem(AUTH_LINK_SEEN_KEY).catch(() => null);
    if (seen === fingerprint) return "duplicate";
    await AsyncStorage.setItem(AUTH_LINK_SEEN_KEY, fingerprint).catch(() => {});

    // The flag goes up BEFORE anyone calls setSession so the gate never sees
    // a recovery SIGNED_IN without it. Non-recovery links (signup
    // confirmation, magic link) are ordinary sign-ins — no flag.
    set({ authLink: link, pendingPasswordReset: action.recovery });
    return "queued";
  },

  applyAuthLink: async (link) => {
    if (!isSupabaseConfigured) return "Demo mode attivo: i link email non sono disponibili.";
    const action = classifyAuthLink(link);
    if (action.kind === "error") return authLinkErrorMessage(action.code);
    if (action.kind === "ignore") return authLinkErrorMessage(null);
    try {
      const result =
        action.kind === "tokens"
          ? await supabase.auth.setSession({
              access_token: action.accessToken,
              refresh_token: action.refreshToken,
            })
          : await supabase.auth.exchangeCodeForSession(action.code);
      if (result.error) {
        reportError("auth/link-session", result.error, { kind: action.kind });
        return authLinkErrorMessage(result.error.code ?? result.error.message);
      }
      // onAuthStateChange(SIGNED_IN) also does this, but resolving the user
      // here means the caller can rely on `user` right after the await.
      const myEpoch = ++authEpoch;
      const user = await buildAuthUserFromSession(result.data.session);
      if (myEpoch === authEpoch) set({ user });
      return null;
    } catch (err) {
      reportError("auth/link-session-threw", err, { kind: action.kind });
      return authLinkErrorMessage(null);
    }
  },

  updatePassword: async (password) => {
    if (!isSupabaseConfigured) {
      throw new Error("Demo mode: password update is disabled.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  endPasswordReset: () => set({ pendingPasswordReset: false, authLink: null }),

  setUserName: (name) => {
    const user = get().user;
    if (!user) return;
    const next = { ...user, name };
    set({ user: next });
    // Demo sessions live in AsyncStorage — keep the cached copy in sync so
    // the rename survives a reload.
    if (!isSupabaseConfigured) {
      void AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }
  },

  hydrate: async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        const myEpoch = ++authEpoch;
        const user = await buildAuthUserFromSession(data.session);
        if (myEpoch === authEpoch) set({ user });
      } else {
        const cached = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
        if (cached) {
          try {
            set({ user: JSON.parse(cached) as AuthUser });
          } catch {
            await AsyncStorage.removeItem(DEMO_STORAGE_KEY).catch(() => {});
          }
        }
      }
    } catch (err) {
      reportError("auth/hydrate", err);
    } finally {
      set({ hydrated: true });
    }
  },

  subscribeAuthChanges: () => {
    if (!isSupabaseConfigured) return () => {};
    // The callback MUST stay synchronous: awaiting a PostgREST call inside
    // it re-enters getSession while Supabase's auth lock is held (e.g. on
    // TOKEN_REFRESHED) and deadlocks the whole client. The setTimeout
    // defers the profile fetch until after the notify resolves and the
    // lock releases — the pattern Supabase's own docs prescribe.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token revoked, password reset on web, manual sign-out elsewhere —
      // any of these zero out the local user so the auth gate kicks them
      // back to login instead of leaving a half-broken state.
      if (event === "SIGNED_OUT" || !session) {
        authEpoch += 1;
        set({ user: null, pendingPasswordReset: false, authLink: null });
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        // Only emitted by exchangeCodeForSession (PKCE) / verifyOtp — never
        // by setSession, which is why receiveAuthLink raises the flag
        // itself. Handling it here keeps a future PKCE/OTP switch safe: the
        // root layout watches the flag and opens /(auth)/reset-password.
        set({ pendingPasswordReset: true });
      }
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY"
      ) {
        const myEpoch = ++authEpoch;
        setTimeout(() => {
          void buildAuthUserFromSession(session)
            .then((user) => {
              if (myEpoch === authEpoch) set({ user });
            })
            .catch((err) => {
              reportError("auth/profile-refresh", err, { event });
            });
        }, 0);
      }
    });
    return () => {
      sub?.subscription.unsubscribe();
    };
  },

  signIn: async (rawEmail, password) => {
    const email = rawEmail.trim().toLowerCase();
    set({ loading: true });
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const myEpoch = ++authEpoch;
        const user = await buildAuthUserFromSession(data.session);
        // A real login supersedes any half-finished recovery, otherwise the
        // gate would pin the user inside the (auth) stack.
        if (myEpoch === authEpoch) set({ user, pendingPasswordReset: false, authLink: null });
      } else {
        // Demo mode is __DEV__-only (enforced in supabase.ts). Tighten further:
        // only the two seed accounts are valid. Arbitrary emails are rejected,
        // closing the "type any email, become admin" escalation vector.
        const match = DEMO_ACCOUNTS.find((a) => a.email === email);
        if (!match) {
          throw new Error("Demo mode accepts only the two demo accounts.");
        }
        const user: AuthUser = {
          id: `demo-${match.role}`,
          email: match.email,
          name: match.name,
          role: match.role,
        };
        await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user));
        set({ user });
      }
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    if (isSupabaseConfigured) {
      // scope: 'global' revokes all sessions across devices for this user.
      // Failing to reach the server should not leave the user stuck — clear
      // local state regardless, but log so monitoring (Phase 4 Sentry) sees it.
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch (err) {
        reportError("auth/sign-out", err);
      }
    }
    await AsyncStorage.removeItem(DEMO_STORAGE_KEY).catch(() => {});
    // Bump the epoch so any profile fetch started before sign-out is
    // discarded instead of writing a dead user back into the store.
    authEpoch += 1;
    set({
      user: null,
      pendingOnboarding: false,
      pendingPasswordReset: false,
      authLink: null,
      viewAsUser: false,
    });
  },
}));
