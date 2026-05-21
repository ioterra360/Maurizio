import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FOLDER_KINDS, type FolderKind } from "./constants";

const STORAGE_KEY = "memora.folder-order.v1";

type State = {
  /** User-defined order. Null until hydrated; defaults to FOLDER_KINDS. */
  order: FolderKind[] | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  move: (kind: FolderKind, dir: "up" | "down") => void;
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
  } catch {
    // Non-fatal: order falls back to default on next launch.
  }
}

export const useFolderOrderStore = create<State>((set, get) => ({
  order: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? clean(JSON.parse(raw)) : null;
      set({ order: parsed ?? [...FOLDER_KINDS], hydrated: true });
    } catch {
      set({ order: [...FOLDER_KINDS], hydrated: true });
    }
  },

  move: (kind, dir) => {
    const current = get().order ?? [...FOLDER_KINDS];
    const idx = current.indexOf(kind);
    if (idx < 0) return;
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[idx], next[target]] = [next[target], next[idx]];
    set({ order: next });
    void persist(next);
  },

  reset: async () => {
    const next = [...FOLDER_KINDS];
    set({ order: next });
    await persist(next);
  },
}));

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
