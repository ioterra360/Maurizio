import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportError } from "./report-error";

/**
 * Preferenze notifiche DI DISPOSITIVO (spec F3): l'interruttore principale,
 * "Avvisami quando un ricordo è pronto per il primo ripasso" e il flag "il
 * pre-prompt è già stato mostrato".
 *
 * Perché AsyncStorage e non profiles: sono lo specchio di un permesso OS
 * che è per-telefono. Una colonna condivisa direbbe "acceso" su un secondo
 * telefono dove nessuno ha mai concesso nulla. Stesso pattern hand-rolled
 * di lib/folder-sort-store.ts; idratato in app/_layout.tsx col tema.
 */

const STORAGE_KEY = "memika.notifications.v1";

export type NotificationPrefs = {
  /** Interruttore principale della schermata Notifiche. */
  enabled: boolean;
  /** Avviso "primo ripasso pronto" per ogni ricordo salvato. */
  firstReview: boolean;
  /** Il pre-prompt con la mascotte è già stato mostrato su questo telefono. */
  promptSeen: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  firstReview: true,
  promptSeen: false,
};

type State = {
  prefs: NotificationPrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPrefs: (patch: Partial<NotificationPrefs>) => void;
};

function clean(raw: unknown): Partial<NotificationPrefs> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<NotificationPrefs> = {};
  if (typeof r.enabled === "boolean") out.enabled = r.enabled;
  if (typeof r.firstReview === "boolean") out.firstReview = r.firstReview;
  if (typeof r.promptSeen === "boolean") out.promptSeen = r.promptSeen;
  return out;
}

async function persist(prefs: NotificationPrefs) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    // Non fatale: la scelta vale per la sessione.
    reportError("notification-prefs/persist", e);
  }
}

export const useNotificationPrefsStore = create<State>((set, get) => ({
  prefs: DEFAULT_NOTIFICATION_PREFS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = raw ? clean(JSON.parse(raw)) : {};
      // Una scelta fatta mentre lo storage rispondeva vince sulla snapshot:
      // si confronta col default, non con lo stato corrente.
      const live = get().prefs;
      const changed: Partial<NotificationPrefs> = {};
      for (const k of ["enabled", "firstReview", "promptSeen"] as const) {
        if (live[k] !== DEFAULT_NOTIFICATION_PREFS[k]) changed[k] = live[k];
      }
      set({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...stored, ...changed }, hydrated: true });
    } catch (e) {
      reportError("notification-prefs/hydrate", e);
      set({ hydrated: true });
    }
  },

  setPrefs: (patch) => {
    const next = { ...get().prefs, ...patch };
    set({ prefs: next });
    void persist(next);
  },
}));
