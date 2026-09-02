import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reportError } from "./report-error";

// v3 (2026-09-02): l'ordine è per folders.ID, non più per kind — con la
// tassonomia le cartelle non sono più 5 e il kind non è più un'identità.
// I v1/v2 (kind-based) non migrano: l'ordine del server (folders.priority)
// viene adottato finché l'utente non trascina di nuovo su questo device.
const STORAGE_KEY = "memika.folder-order.v3";
const LEGACY_STORAGE_KEYS = ["memika.folder-order.v1", "memika.folder-order.v2"];

type State = {
  /** Ordine scelto dall'utente (folder id). Null finché non idratato. */
  order: string[] | null;
  hydrated: boolean;
  /** True once the user dragged on THIS device (a persisted order exists). */
  userSet: boolean;
  hydrate: () => Promise<void>;
  /** Replace the whole order at once — used by drag-to-reorder. */
  setOrder: (next: string[]) => void;
  /**
   * Take the server order (folders.priority) as the display order while
   * the user has not dragged on this device. In memory only: the DB stays
   * the source until a local drag persists a choice.
   */
  adoptOrder: (next: string[]) => void;
  reset: () => Promise<void>;
};

function clean(arr: unknown): string[] | null {
  if (!Array.isArray(arr)) return null;
  const valid = [...new Set(arr.filter((k): k is string => typeof k === "string" && k.length > 0))];
  return valid.length > 0 ? valid : null;
}

async function persist(order: string[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    // Non-fatal: order falls back to the server order on next launch.
    reportError("folder-order/persist", e);
  }
}

export const useFolderOrderStore = create<State>((set, get) => ({
  order: null,
  hydrated: false,
  userSet: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? clean(JSON.parse(raw)) : null;
      for (const k of LEGACY_STORAGE_KEYS) {
        void AsyncStorage.removeItem(k).catch(() => undefined);
      }
      // A drag completed while AsyncStorage was resolving already set (and
      // persisted) a fresher order — don't clobber it with the stale snapshot.
      if (get().userSet) {
        set({ hydrated: true });
        return;
      }
      set({ order: parsed ?? get().order, hydrated: true, userSet: parsed !== null });
    } catch (e) {
      reportError("folder-order/hydrate", e);
      set({ hydrated: true });
    }
  },

  setOrder: (next) => {
    const cleaned = clean(next);
    if (!cleaned) return;
    set({ order: cleaned, userSet: true });
    void persist(cleaned);
  },

  adoptOrder: (next) => {
    if (get().userSet) return;
    const cleaned = clean(next);
    if (!cleaned) return;
    set({ order: cleaned });
  },

  reset: async () => {
    set({ order: null, userSet: false });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      reportError("folder-order/reset", e);
    }
  },
}));

/**
 * Display priority (1-based) of a folder under the user's custom order.
 * Una cartella non presente nell'ordine locale (appena creata) va in coda.
 */
export function priorityOf(folderId: string, order: string[] | null): number {
  if (!order) return 1;
  const i = order.indexOf(folderId);
  return i === -1 ? order.length + 1 : i + 1;
}

/**
 * Sort a list of folders (keyed by id) according to the user's custom
 * order. Items missing from the order get appended at the end, keeping
 * their relative (server) order.
 */
export function applyFolderOrder<T extends { id: string }>(
  items: T[],
  order: string[] | null,
): T[] {
  if (!order) return items;
  const rank = new Map<string, number>(order.map((k, i) => [k, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
