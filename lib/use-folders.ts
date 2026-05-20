/**
 * React hooks for folder + folder-detail reads.
 *
 * Thin wrappers around lib/api.ts that bind the result to a component's
 * lifecycle. They intentionally do NOT cache between mounts — the screens
 * are short-lived and we want fresh stats every time the user lands on
 * Knowledge or Today. When Phase 3 step C wires writes through a Zustand
 * store, we'll subscribe to that store instead of refetching.
 *
 * Demo mode (EXPO_PUBLIC_DEMO_MODE=true) resolves synchronously through
 * the api layer, so `loading` is `true` for one render at most.
 */

import { useCallback, useEffect, useState } from "react";

import {
  fetchFolderDetail,
  fetchFoldersWithStats,
} from "./api";
import type { Memory, FolderWithStats } from "./mappers";
import type { FolderKind } from "./constants";
import { useAuthStore } from "./auth-store";

type FoldersResult = {
  folders: FolderWithStats[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useFoldersWithStats(): FoldersResult {
  const userId = useAuthStore((s) => s.user?.id);
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchFoldersWithStats(uid);
      setFolders(next);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    load(userId);
  }, [userId, load]);

  const refetch = useCallback(() => {
    if (userId) load(userId);
  }, [userId, load]);

  return { folders, loading, error, refetch };
}

type FolderDetailResult = {
  folder: FolderWithStats | null;
  items: Memory[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useFolderDetail(kind: FolderKind | null): FolderDetailResult {
  const userId = useAuthStore((s) => s.user?.id);
  const [folder, setFolder] = useState<FolderWithStats | null>(null);
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (uid: string, k: FolderKind) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFolderDetail(uid, k);
      setFolder(result?.folder ?? null);
      setItems(result?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId || !kind) {
      setFolder(null);
      setItems([]);
      setLoading(false);
      return;
    }
    load(userId, kind);
  }, [userId, kind, load]);

  const refetch = useCallback(() => {
    if (userId && kind) load(userId, kind);
  }, [userId, kind, load]);

  return { folder, items, loading, error, refetch };
}
