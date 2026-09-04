/**
 * Preferenza tema (Default / Chiaro / Scuro) — modellata ESATTAMENTE su
 * lib/i18n (preferenza + risoluzione + persistenza + idratazione prima del
 * primo frame), che risolve lo stesso identico problema per la lingua.
 *
 * "Default" segue il telefono: dalla build 3 app.json porta
 * userInterfaceStyle "automatic", l'OS consegna il tratto reale e lo store
 * lo risolve qui sotto senza altro codice. (Fino alla build 2 era "light"
 * di proposito — input del fingerprint — e Default valeva sempre chiaro.)
 *
 * Il resolved scheme alimenta DUE consumatori che devono restare d'accordo:
 *   1. useColors()/useThemeTokens() — gli stili inline;
 *   2. NativeWind (colorScheme.set) — le variabili CSS di global.css, che
 *      fanno flippare le className (bg-warm-white, text-navy, …).
 */

import { create } from "zustand";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nwColorScheme } from "nativewind";

import { PALETTES, type ThemeScheme, type ThemeTokens } from "./palettes";

export type ThemePreference = ThemeScheme | "system";

const STORAGE_KEY = "memika.theme";
const VALID: readonly ThemeScheme[] = ["light", "dark"];

function detectSystemScheme(): ThemeScheme {
  try {
    return Appearance.getColorScheme() === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function resolve(preference: ThemePreference): ThemeScheme {
  return preference === "system" ? detectSystemScheme() : preference;
}

/** Tiene NativeWind allineato allo scheme risolto (variabili CSS). */
function syncNativeWind(scheme: ThemeScheme) {
  try {
    nwColorScheme.set(scheme);
  } catch {
    // Fuori da un ambiente NativeWind (vitest): gli stili inline bastano.
  }
}

type ThemeState = {
  preference: ThemePreference;
  scheme: ThemeScheme;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (p: ThemePreference) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: "system",
  scheme: resolve("system"),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const preference: ThemePreference = (VALID as readonly string[]).includes(raw ?? "")
        ? (raw as ThemeScheme)
        : "system";
      const scheme = resolve(preference);
      set({ preference, scheme, hydrated: true });
      syncNativeWind(scheme);
    } catch {
      // La preferenza vale comunque per questa sessione.
      set({ hydrated: true });
      syncNativeWind(get().scheme);
    }
  },

  setPreference: async (preference) => {
    const scheme = resolve(preference);
    set({ preference, scheme });
    syncNativeWind(scheme);
    try {
      // "system" è memorizzato come ASSENZA della chiave (stesso schema di
      // lib/i18n: il default non è un valore, è la mancanza di una scelta).
      if (preference === "system") await AsyncStorage.removeItem(STORAGE_KEY);
      else await AsyncStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Non fatale: la scelta vale per la sessione.
    }
  },
}));

// L'utente cambia tema di sistema con l'app aperta: se la preferenza è
// "system", lo scheme risolto segue. Listener a livello di modulo, come la
// subscription onAuthStateChange in auth-store.
Appearance.addChangeListener(() => {
  const s = useThemeStore.getState();
  if (s.preference !== "system") return;
  const next = detectSystemScheme();
  if (next !== s.scheme) {
    useThemeStore.setState({ scheme: next });
    syncNativeWind(next);
  }
});

/** Il set di token del tema corrente. Re-render al cambio tema. */
export function useThemeTokens(): ThemeTokens {
  const scheme = useThemeStore((s) => s.scheme);
  return PALETTES[scheme];
}

/** Scorciatoia per il consumo più comune: i colori del tema corrente. */
export function useColors(): ThemeTokens["colors"] {
  return useThemeTokens().colors;
}

/** Per codice non-React (rare util di modulo): i token del tema ADESSO. */
export function currentTokens(): ThemeTokens {
  return PALETTES[useThemeStore.getState().scheme];
}
