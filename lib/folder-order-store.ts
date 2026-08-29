import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FOLDER_KINDS, type FolderKind } from "./constants";
import { reportError } from "./report-error";

// v2 (2026-08-29): v1 orders predate the folders.priority mirror and were
// never written to the DB, so they must not count as a user choice on this
// device — the server order is adopted until the next drag.
const STORAGE_KEY = "memika.folder-order.v2";
const LEGACY_STORAGE_KEY = "memika.folder-order.v1";

type State = {
  /** User-defined order. Null until hydrated; defaults to FOLDER_KINDS. */
  order: FolderKind[] | null;
  hydrated: boolean;
  /** True once the user dragged on THIS device (a persisted order exists). */
  userSet: boolean;
  hydrate: () => Promise<void>;
  /** Replace the whole order at once — used by drag-to-reorder. */
  setOrder: (next: FolderKind[]) => void;
  /**
   * Take the server order (folders.priority) as the display order while
   * the user has not dragged on this device. In memory only: the DB stays
   * the source until a local drag persists a choice.
   */
  adoptOrder: (next: FolderKind[]) => void;
  reset: () => Promise<void>;
};

function clean(arr: unknown): FolderKind[] | null {
  if (!Array.isArray(arr)) return null;
  const valid = arr.filter((k): k is FolderKind =>
    (FOLDER_KINDS as readonly string[]).includes(k as string),
  );
  if (valid.length === 0) return null;
  // Append any folders not yet present (e.g. after a kind is added in code)
  for (const k of FOLDER_KINDS) {
    if (!valid.includes(k)) valid.push(k);
  }
  return valid;
}

async function persist(order: FolderKind[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    // Non-fatal: order falls back to default on next launch.
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
      void AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
      // A drag completed while AsyncStorage was resolving already set (and
      // persisted) a fresher order — don't clobber it with the stale snapshot.
      if (get().userSet) {
        set({ hydrated: true });
        return;
      }
      set({ order: parsed ?? get().order ?? [...FOLDER_KINDS], hydrated: true, userSet: parsed !== null });
    } catch (e) {
      reportError("folder-order/hydrate", e);
      set((s) => ({ order: s.order ?? [...FOLDER_KINDS], hydrated: true }));
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
    const next = [...FOLDER_KINDS];
    set({ order: next, userSet: true });
    await persist(next);
  },
}));

/**
 * Display priority (1-based) of a folder under the user's custom order.
 * Falls back to the default FOLDER_KINDS order (which matches the seed
 * priorities 1-4) until the store is hydrated.
 */
export function priorityOf(kind: FolderKind, order: FolderKind[] | null): number {
  const src = order ?? FOLDER_KINDS;
  const i = src.indexOf(kind);
  return i === -1 ? FOLDER_KINDS.indexOf(kind) + 1 : i + 1;
}

/**
 * Sort a list of items keyed by `kind` according to the user's custom order.
 * Items whose kind is missing from the order get appended at the end.
 */
export function applyFolderOrder<T extends { kind: string }>(
  items: T[],
  order: FolderKind[] | null,
): T[] {
  if (!order) return items;
  const rank = new Map<string, number>(order.map((k, i) => [k, i]));
  return [...items].sort((a, b) => {
    const ra = rank.get(a.kind) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.kind) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
