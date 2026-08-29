import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FolderKind } from "./constants";
import { isFolderSort, type FolderSort } from "./folder-sort";
import { reportError } from "./report-error";

const STORAGE_KEY = "memika.folder-sort.v1";
const DEFAULT_SORT: FolderSort = "due";

type ByKind = Partial<Record<FolderKind, FolderSort>>;

type State = {
  /** Sort choice per folder kind (folders are keyed by kind in the app). */
  byKind: ByKind;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSort: (kind: FolderKind, sort: FolderSort) => void;
  sortFor: (kind: FolderKind) => FolderSort;
};

function clean(raw: unknown): ByKind {
  if (!raw || typeof raw !== "object") return {};
  const out: ByKind = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isFolderSort(v)) out[k as FolderKind] = v;
  }
  return out;
}

async function persist(byKind: ByKind) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(byKind));
  } catch (e) {
    // Non-fatal: the choice falls back to the default on next launch.
    reportError("folder-sort/persist", e);
  }
}

/**
 * Persisted per-folder sort choice for the folder screen — same hand-rolled
 * hydrate/persist pattern as lib/folder-order-store.ts. Hydrated once in
 * app/(app)/_layout.tsx.
 */
export const useFolderSortStore = create<State>((set, get) => ({
  byKind: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = raw ? clean(JSON.parse(raw)) : {};
      // A choice made while storage was resolving wins over the snapshot.
      set({ byKind: { ...stored, ...get().byKind }, hydrated: true });
    } catch (e) {
      reportError("folder-sort/hydrate", e);
      set({ hydrated: true });
    }
  },

  setSort: (kind, sort) => {
    const next = { ...get().byKind, [kind]: sort };
    set({ byKind: next });
    void persist(next);
  },

  sortFor: (kind) => get().byKind[kind] ?? DEFAULT_SORT,
}));
