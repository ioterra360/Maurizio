import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportError } from "./report-error";

/**
 * "Il tutorial di benvenuto e' gia' stato mostrato su questo telefono."
 *
 * Perche' AsyncStorage e non profiles: e' una preferenza di dispositivo,
 * come le notifiche (lib/notification-prefs-store.ts). Un secondo telefono
 * lo rivede una volta e lo salta in un tocco; una colonna condivisa
 * costerebbe una migrazione e una grant su profiles (bloccata da
 * 20260825121500_lock_profiles_columns.sql) per un dato che non deve
 * viaggiare. Idratato in app/_layout.tsx insieme al tema.
 */

export const TUTORIAL_STORAGE_KEY = "memika.tutorial.v1";

type State = {
  seen: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => void;
};

async function persist(seen: boolean) {
  try {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ seen }));
  } catch (e) {
    // Non fatale: al prossimo avvio si rivede il tutorial, che si salta.
    reportError("tutorial/persist", e);
  }
}

export const useTutorialStore = create<State>((set, get) => ({
  seen: false,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const stored =
        parsed && typeof parsed === "object" && typeof (parsed as { seen?: unknown }).seen === "boolean"
          ? (parsed as { seen: boolean }).seen
          : false;
      // Un markSeen arrivato mentre lo storage rispondeva vince sulla
      // snapshot: "visto" non torna mai indietro.
      set({ seen: stored || get().seen, hydrated: true });
    } catch (e) {
      reportError("tutorial/hydrate", e);
      set({ hydrated: true });
    }
  },

  markSeen: () => {
    if (get().seen) return;
    set({ seen: true });
    void persist(true);
  },
}));
