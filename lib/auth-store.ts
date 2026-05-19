import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";

export type UserRole = "user" | "admin";

export type AuthUser = {
  email: string;
  name: string;
  role: UserRole;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const STORAGE_KEY = "memora.demo-auth";

/**
 * Demo-mode auth: when Supabase is not yet configured we fall back to the two
 * demo accounts from the design mockup so the rest of the app can be wired
 * before the Supabase project exists.
 */
const DEMO_ACCOUNTS: Record<string, AuthUser> = {
  "angelo.casula@gmail.com": {
    email: "angelo.casula@gmail.com",
    name: "Angelo Casula",
    role: "user",
  },
  "maurizio.cocco@memora.app": {
    email: "maurizio.cocco@memora.app",
    name: "Maurizio Cocco",
    role: "admin",
  },
};

function deriveRole(email: string): UserRole {
  const lower = email.toLowerCase();
  return lower.includes("admin") || lower.endsWith("@memora.app") ? "admin" : "user";
}

function deriveName(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Memora user";
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  hydrated: false,

  hydrate: async () => {
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const email = data.session.user.email ?? "";
          set({
            user: {
              email,
              name: data.session.user.user_metadata?.name ?? deriveName(email),
              role: deriveRole(email),
            },
          });
        }
      } else {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) set({ user: JSON.parse(cached) as AuthUser });
      }
    } catch (err) {
      console.warn("[Memora] auth hydrate failed", err);
    } finally {
      set({ hydrated: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const u = data.user;
        if (!u) throw new Error("No user returned");
        set({
          user: {
            email: u.email ?? email,
            name: u.user_metadata?.name ?? deriveName(email),
            role: deriveRole(email),
          },
        });
      } else {
        // Demo mode — accept the two seed accounts, ignore password.
        const match = DEMO_ACCOUNTS[email.toLowerCase()] ?? {
          email,
          name: deriveName(email),
          role: deriveRole(email),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(match));
        set({ user: match });
      }
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut().catch(() => {});
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));

export { DEMO_ACCOUNTS };
