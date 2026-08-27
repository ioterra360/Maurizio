import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPersistedSession, supabase, isSupabaseConfigured } from "./supabase";
import { t } from "@/lib/i18n";
import { reportError } from "./report-error";
import { decideAuthEvent } from "./auth-events";
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
   * Exchanges the PKCE code carried by a link for a Supabase session.
   * Implicit-flow token links are refused (see the implementation). Resolves
   * with a user-facing, localised error message on failure, null on success.
   * Drops `authLink` from the store as its first step, so it is idempotent
   * across screen remounts.
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
  /**
   * Ends the session. `scope: "global"` (default) revokes every session of
   * the user on every device; `"local"` only this one — used when
   * abandoning a recovery link, which must not log the user out of their
   * other phone. The persisted session is ALWAYS cleared locally, even when
   * the server call fails.
   */
  signOut: (options?: { scope?: "global" | "local" }) => Promise<void>;
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
    email: "memikaapp@gmail.com",
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
  return cleaned || t("authStore.fallbackUserName");
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
    if (!isSupabaseConfigured) return t("authStore.demoLinksUnavailable");
    const action = classifyAuthLink(link);
    if (action.kind === "error") return authLinkErrorMessage(action.code);
    if (action.kind === "ignore") return authLinkErrorMessage(null);
    // Implicit-flow links (`#access_token=…&refresh_token=…`) are refused:
    // the client runs the PKCE flow (lib/supabase.ts), so Supabase never
    // sends them any more, and accepting arbitrary bearer tokens from a URL
    // would let any app/web page log this device into an attacker's account
    // (login CSRF). The parser still recognises them so the screen shows a
    // clear error instead of "open the link from your email".
    if (action.kind === "tokens") {
      reportError("auth/link-implicit-refused", new Error("implicit-flow auth link refused"), {
        recovery: action.recovery,
      });
      return authLinkErrorMessage("invalid");
    }
    // Consume the link BEFORE the exchange: a remount of the target screen
    // (e.g. a route replace landing on the same screen) must never re-send
    // the code, and a PKCE code is single-use anyway.
    set({ authLink: null });
    try {
      const result = await supabase.auth.exchangeCodeForSession(action.code);
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
      // The decision table lives in lib/auth-events.ts (unit-tested). The
      // one rule that matters: INITIAL_SESSION(null) — emitted for every new
      // subscription when nothing is persisted — must NOT wipe a recovery
      // link queued by the root layout a moment earlier; only an explicit
      // SIGNED_OUT (token revoked, password reset on web, sign-out
      // elsewhere) ends a pending reset.
      const decision = decideAuthEvent(event, Boolean(session));
      if (decision.clearUser) {
        authEpoch += 1;
        set(
          decision.clearRecovery
            ? { user: null, pendingPasswordReset: false, authLink: null }
            : { user: null },
        );
        return;
      }
      if (decision.markRecovery) {
        // Emitted by exchangeCodeForSession when the PKCE code came from a
        // recovery email. receiveAuthLink already raised the flag from the
        // URL path; this covers a future OTP flow. The root layout watches
        // the flag and opens /(auth)/reset-password.
        set({ pendingPasswordReset: true });
      }
      if (decision.refreshProfile && session) {
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

  signOut: async (options) => {
    const scope = options?.scope ?? "global";
    if (isSupabaseConfigured) {
      // auth-js only removes the persisted session when the server call
      // succeeds (or answers 401/403/404). On a network failure / timeout
      // it RETURNS `{ error }` and keeps `sb-…-auth-token` in SecureStore,
      // so the next cold start would silently restore a user who pressed
      // "Esci", abandoned a recovery link, or just deleted their account.
      // Failing to reach the server must never leave that behind.
      let failed = false;
      try {
        const { error } = await supabase.auth.signOut({ scope });
        if (error) {
          failed = true;
          reportError("auth/sign-out", error, { scope });
        }
      } catch (err) {
        failed = true;
        reportError("auth/sign-out-threw", err, { scope });
      }
      if (failed) {
        await clearPersistedSession();
        // With the storage empty this skips the network entirely and just
        // runs auth-js's own teardown (SIGNED_OUT to subscribers, refresh
        // timer, code verifier).
        await supabase.auth.signOut({ scope: "local" }).catch((err: unknown) => {
          reportError("auth/sign-out-local", err);
        });
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
