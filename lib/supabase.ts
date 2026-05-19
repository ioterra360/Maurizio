import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const forceDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

const hasSupabaseCreds = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * True when the app should talk to the real Supabase backend.
 * False (demo mode) when either:
 *   - env vars are missing, or
 *   - EXPO_PUBLIC_DEMO_MODE=true is set explicitly
 * Demo mode lets the two seed accounts (Angelo / Maurizio) sign in locally
 * with any password — useful before the real users table is provisioned.
 */
export const isSupabaseConfigured = hasSupabaseCreds && !forceDemoMode;

if (__DEV__) {
  if (!hasSupabaseCreds) {
    console.warn("[Memora] Supabase env vars missing — running in offline demo mode.");
  } else if (forceDemoMode) {
    console.warn("[Memora] EXPO_PUBLIC_DEMO_MODE=true — Supabase creds present but bypassed.");
  } else {
    console.log("[Memora] Supabase real auth enabled.");
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
