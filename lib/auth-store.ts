import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";

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
  /** Updates the cached user name after a successful profile save. */
  setUserName: (name: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Subscribes to Supabase auth events. Returns an unsubscribe fn. */
  subscribeAuthChanges: () => () => void;
};

const DEMO_STORAGE_KEY = "memika.demo-auth";

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

  if (error && __DEV__) {
    console.warn("[Memika] profile lookup failed", error.message);
  }

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

  setPendingOnboarding: (pending) => set({ pendingOnboarding: pending }),

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
      if (__DEV__) console.warn("[Memika] auth hydrate failed", err);
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
        set({ user: null });
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        const myEpoch = ++authEpoch;
        setTimeout(() => {
          void buildAuthUserFromSession(session)
            .then((user) => {
              if (myEpoch === authEpoch) set({ user });
            })
            .catch((err) => {
              if (__DEV__) console.warn("[Memika] auth profile refresh failed", err);
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
        if (myEpoch === authEpoch) set({ user });
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
        if (__DEV__) console.warn("[Memika] supabase.signOut failed", err);
      }
    }
    await AsyncStorage.removeItem(DEMO_STORAGE_KEY).catch(() => {});
    // Bump the epoch so any profile fetch started before sign-out is
    // discarded instead of writing a dead user back into the store.
    authEpoch += 1;
    set({ user: null, pendingOnboarding: false });
  },
}));
