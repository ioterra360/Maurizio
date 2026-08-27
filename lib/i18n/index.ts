/**
 * Memika i18n — tiny, typed, dependency-free.
 *
 * - `it` (lib/i18n/it.ts) is the source of truth for keys; `en` must carry
 *   every key (a missing translation is a TypeScript error, not a runtime
 *   surprise). Runtime still falls back to Italian defensively.
 * - `t(key, vars)` interpolates `{name}` placeholders; `tp(base, count)`
 *   picks `<base>_one` / `<base>_other`.
 * - The active locale lives in a zustand store: device language by default
 *   (it/fr/es phones → that language, everything else → en), overridable from Settings
 *   and persisted in AsyncStorage. Components use `useT()` so a change
 *   re-renders them; non-React code calls `t()` directly at call time —
 *   never cache translated strings in module-level constants.
 * - No native module: the device tag comes from I18nManager (Android) /
 *   SettingsManager (iOS) / navigator (web), so this ships OTA.
 */
import { useMemo } from "react";
import { I18nManager, NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { it } from "./it";
import { en } from "./en";
import { fr } from "./fr";
import { es } from "./es";

export type Locale = "it" | "en" | "fr" | "es";
export const LOCALES: readonly Locale[] = ["it", "en", "fr", "es"] as const;
/** "system" = follow the phone; otherwise a forced locale. */
export type LocalePreference = Locale | "system";

export type TKey = keyof typeof it;
/** `x.items` for a pair of keys `x.items_one` / `x.items_other`. */
export type PluralBase = TKey extends infer K
  ? K extends `${infer B}_one`
    ? B
    : never
  : never;
export type Vars = Record<string, string | number>;

const CATALOGS: Record<Locale, Record<TKey, string>> = { it, en, fr, es };
const STORAGE_KEY = "memika.locale";
const FALLBACK_FOR_UNSUPPORTED: Locale = "en";

/** "it-IT" / "fr_CA" / "es" → supported locale; unknown → English. */
export function localeFromTag(tag: string | null | undefined): Locale {
  const lang = (tag ?? "").toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(lang) ? (lang as Locale) : FALLBACK_FOR_UNSUPPORTED;
}

export function detectDeviceLocale(): Locale {
  let tag: string | undefined;
  try {
    if (Platform.OS === "android") {
      tag = (I18nManager.getConstants?.() as { localeIdentifier?: string } | undefined)?.localeIdentifier;
    } else if (Platform.OS === "ios") {
      const settings = (NativeModules as { SettingsManager?: { settings?: { AppleLocale?: string; AppleLanguages?: string[] } } })
        .SettingsManager?.settings;
      tag = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    } else if (typeof navigator !== "undefined") {
      tag = navigator.language;
    }
  } catch {
    // Fall through to the default below.
  }
  return localeFromTag(tag);
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

type LocaleState = {
  preference: LocalePreference;
  locale: Locale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: LocalePreference) => Promise<void>;
};

const resolve = (preference: LocalePreference): Locale =>
  preference === "system" ? detectDeviceLocale() : preference;

export const useLocaleStore = create<LocaleState>((set) => ({
  preference: "system",
  locale: detectDeviceLocale(),
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const preference: LocalePreference = (LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : "system";
      set({ preference, locale: resolve(preference), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setPreference: async (preference) => {
    set({ preference, locale: resolve(preference) });
    try {
      if (preference === "system") await AsyncStorage.removeItem(STORAGE_KEY);
      else await AsyncStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Preference still applies for this session.
    }
  },
}));

export function getLocale(): Locale {
  return useLocaleStore.getState().locale;
}

/** Translate a key in the given (default: current) locale. */
export function t(key: TKey, vars?: Vars, locale: Locale = getLocale()): string {
  const template = CATALOGS[locale][key] ?? CATALOGS.it[key] ?? key;
  return interpolate(template, vars);
}

/** Plural-aware translate: `<base>_one` for 1, `<base>_other` otherwise. `{count}` is injected. */
export function tp(base: PluralBase, count: number, vars?: Vars, locale: Locale = getLocale()): string {
  const key = `${base}_${count === 1 ? "one" : "other"}` as TKey;
  return t(key, { count, ...vars }, locale);
}

/** Hook: translators bound to the current locale, so a change re-renders the component. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return useMemo(
    () => ({
      locale,
      t: (key: TKey, vars?: Vars) => t(key, vars, locale),
      tp: (base: PluralBase, count: number, vars?: Vars) => tp(base, count, vars, locale),
    }),
    [locale],
  );
}
