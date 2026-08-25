import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { resolveDemoMode } from "./demo-mode";
import { SUPABASE_FETCH_TIMEOUT_MS, withRequestTimeout } from "./network";
import { reportError } from "./report-error";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const hasSupabaseCreds = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Demo mode is ONLY honored in development builds — see lib/demo-mode.ts for
 * the rules. A release build with EXPO_PUBLIC_DEMO_MODE=true ignores the
 * flag, and a release build WITHOUT credentials refuses to boot rather than
 * silently serving the seed accounts (which would accept any password).
 */
const demoDecision = resolveDemoMode({
  hasCreds: hasSupabaseCreds,
  forceFlag: process.env.EXPO_PUBLIC_DEMO_MODE === "true",
  isDev: __DEV__,
});

if (demoDecision.reason === "release-missing-creds") {
  // Only reachable when eas.json `build.<profile>.env` is wrong. Crashing at
  // startup is the point: this must be caught on the first install, never in
  // a store review.
  throw new Error(
    "[Memika] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing " +
      "in a release build. Set them in eas.json under build.<profile>.env.",
  );
}

export const isDemoMode = demoDecision.demo;
export const isSupabaseConfigured = !demoDecision.demo;

if (__DEV__) {
  if (demoDecision.reason === "no-creds") {
    console.warn("[Memika] Supabase env vars missing — running in offline demo mode.");
  } else if (demoDecision.reason === "forced") {
    console.warn("[Memika] EXPO_PUBLIC_DEMO_MODE=true — Supabase creds present but bypassed.");
  } else {
    console.log("[Memika] Supabase real auth enabled.");
  }
}

/**
 * SecureStore-backed storage adapter for Supabase auth tokens.
 *
 * SecureStore is unavailable on web (we don't ship web yet, but a future
 * `expo start --web` shouldn't crash). On native, the AsyncStorage fallback
 * covers Keychain/Keystore runtime failures — NOT the 2 KB value limit:
 * expo-secure-store in SDK 54 only console.warns on oversized values and
 * still stores them, it never throws for size. If a future SDK turns that
 * warning into an error, the same catch path will absorb it. The fallback
 * must be symmetric: anything setItem writes to AsyncStorage has to be
 * readable by getItem on the next launch.
 */
const SECURE_KEY_PREFIX = "memika.";

const SecureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    try {
      const value = await SecureStore.getItemAsync(SECURE_KEY_PREFIX + key);
      if (value !== null) return value;
    } catch (err) {
      reportError("secure-store/get-item", err);
    }
    // Symmetric with setItem's fallback: a session written to AsyncStorage when
    // SecureStore failed must be readable on the next launch.
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    try {
      await SecureStore.setItemAsync(SECURE_KEY_PREFIX + key, value);
      return;
    } catch (err) {
      reportError("secure-store/set-item", err);
    }
    // Drop any stale SecureStore copy so getItem (SecureStore-first) can't
    // return an older token than the one we're about to write.
    await SecureStore.deleteItemAsync(SECURE_KEY_PREFIX + key).catch(() => {});
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(SECURE_KEY_PREFIX + key);
    } catch {
      // SecureStore throws if the key doesn't exist — that's fine.
    }
    // Best-effort cleanup of any legacy AsyncStorage fallback writes.
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: SecureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      // Every Supabase request (auth, REST, RPC) is aborted after 15 s so a
      // dead connection surfaces as an error the UI can retry instead of a
      // spinner that never resolves. Requests that carry their own signal
      // keep it. See lib/network.ts for why AbortSignal.timeout() is not
      // used (not available on Hermes / RN 0.81).
      fetch: withRequestTimeout(
        (input, init) => fetch(input, init),
        SUPABASE_FETCH_TIMEOUT_MS,
      ),
    },
  },
);
