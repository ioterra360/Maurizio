import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const hasSupabaseCreds = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Demo mode is ONLY honored in development builds. A production binary with
 * EXPO_PUBLIC_DEMO_MODE=true accidentally set will ignore it — that flag was
 * an early-dev convenience and must never gate auth in a release.
 */
const forceDemoMode =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "true";

export const isSupabaseConfigured = hasSupabaseCreds && !forceDemoMode;
export const isDemoMode = !isSupabaseConfigured;

if (__DEV__) {
  if (!hasSupabaseCreds) {
    console.warn("[Memika] Supabase env vars missing — running in offline demo mode.");
  } else if (forceDemoMode) {
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
      if (__DEV__) console.warn("[Memika] SecureStore.getItem failed, falling back", err);
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
      if (__DEV__) console.warn("[Memika] SecureStore.setItem failed, falling back", err);
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
  },
);
