/**
 * Single point of Supabase access for the entire app.
 *
 * Pattern borrowed from the TLC mobile project: components NEVER import
 * @supabase/supabase-js directly. They call functions from this file.
 *
 * Why it matters:
 * - One place to add error logging / retry / cache later
 * - Mappers run on every read so the rest of the app speaks camelCase
 * - When demo mode is active, every API function has a clear "what does
 *   this return without a backend?" branch instead of scattered guards
 * - Phase 3 SRS scheduler only needs to know about lib/api, not the DB
 *
 * Add functions feature-by-feature as Phase 2/3 lands. Today this file
 * is intentionally thin — auth + profile lookups + a single seed-folder
 * helper. Growth is expected.
 */

import { supabase, isDemoMode } from "./supabase";
import {
  type Folder,
  type FolderRow,
  type FolderWithStats,
  type Memory,
  type MemoryRow,
  type Profile,
  type ProfileRow,
  mapFolder,
  mapMemory,
  mapProfile,
} from "./mappers";
import { FOLDER_DEFAULTS, type FolderKind } from "./constants";
import { getAllFolderSeeds, getFolderSeed, type FolderSeed } from "./folder-data";
import { isoFromRelativeLabel } from "./format";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "name" | "dailyInputCap" | "calmMode" | "weeklyDigest" | "morningReviewAt" | "eveningReviewAt">>,
): Promise<void> {
  if (isDemoMode) return;
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.dailyInputCap !== undefined) payload.daily_input_cap = patch.dailyInputCap;
  if (patch.calmMode !== undefined) payload.calm_mode = patch.calmMode;
  if (patch.weeklyDigest !== undefined) payload.weekly_digest = patch.weeklyDigest;
  if (patch.morningReviewAt !== undefined) payload.morning_review_at = patch.morningReviewAt;
  if (patch.eveningReviewAt !== undefined) payload.evening_review_at = patch.eveningReviewAt;
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function fetchFolders(userId: string): Promise<Folder[]> {
  if (isDemoMode) {
    return FOLDER_DEFAULTS.map((d, i) => ({
      id: `demo-folder-${i}`,
      userId,
      kind: d.kind,
      name: d.name,
      priority: d.priority,
      color: null,
      icon: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("priority")
    .returns<FolderRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapFolder);
}

/**
 * Seed the four default folders for a new user. Idempotent — uses upsert.
 * Called once during onboarding (Phase 2).
 */
export async function seedDefaultFolders(userId: string): Promise<void> {
  if (isDemoMode) return;
  const rows = FOLDER_DEFAULTS.map((d) => ({
    user_id: userId,
    kind: d.kind,
    name: d.name,
    priority: d.priority,
  }));
  const { error } = await supabase
    .from("folders")
    .upsert(rows, { onConflict: "user_id,kind", ignoreDuplicates: true });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Memories (used by Knowledge, Folder detail, SRS queue — Phase 2/3)
// ---------------------------------------------------------------------------

export async function fetchMemoriesForFolder(folderId: string): Promise<Memory[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("folder_id", folderId)
    .order("next_review_at")
    .returns<MemoryRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMemory);
}

/** The SRS queue: memories due now or earlier, capped at `limit`. */
export async function fetchDueMemories(userId: string, limit = 50): Promise<Memory[]> {
  if (isDemoMode) return [];
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .neq("state", "archived")
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at")
    .limit(limit)
    .returns<MemoryRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMemory);
}

// ---------------------------------------------------------------------------
// Folder + stats (Knowledge / Today / Folder detail headers)
// ---------------------------------------------------------------------------

/**
 * Build a FolderWithStats from a demo-mode FolderSeed. Centralized here so
 * the Knowledge list, the Today recommendation copy, and the folder detail
 * hero all start from the same numbers — no per-component duplication of
 * "how do I roll up these counts".
 */
function seedToFolderWithStats(userId: string, s: FolderSeed): FolderWithStats {
  return {
    id: `demo-folder-${s.kind}`,
    userId,
    kind: s.kind,
    name: s.name,
    priority: s.priority,
    color: null,
    icon: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    count: s.count,
    active: s.active,
    fading: s.fading,
    archived: s.archived,
    addedThisWeek: s.addedThisWeek,
  };
}

function pctRound(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Folders + per-folder retention stats. The hot read for Knowledge, Today,
 * and the folder detail hero. Returns folders ordered by `priority`.
 *
 * Demo mode reads from the shared folder-data seed so the offline UI shows
 * the same numbers as the rest of the design contract. Remote mode joins
 * folders against memories and rolls up `state` counts in JS — that's one
 * folders query + N memories queries; cheap at 4 default folders, and we
 * will replace it with a server-side view in Phase 3 step C.
 */
export async function fetchFoldersWithStats(userId: string): Promise<FolderWithStats[]> {
  if (isDemoMode) {
    return getAllFolderSeeds().map((s) => seedToFolderWithStats(userId, s));
  }

  const folders = await fetchFolders(userId);
  const enriched = await Promise.all(
    folders.map(async (folder) => {
      const items = await fetchMemoriesForFolder(folder.id);
      const count = items.length;
      const active = items.filter((m) => m.state === "active").length;
      const fading = items.filter((m) => m.state === "fading").length;
      const archived = items.filter((m) => m.state === "archived").length;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const addedThisWeek = items.filter(
        (m) => new Date(m.createdAt).getTime() >= weekAgo,
      ).length;
      return {
        ...folder,
        count,
        active: pctRound(active, count),
        fading: pctRound(fading, count),
        archived: pctRound(archived, count),
        addedThisWeek,
      } satisfies FolderWithStats;
    }),
  );
  return enriched.sort((a, b) => a.priority - b.priority);
}

/**
 * The data the folder detail screen needs in one round-trip: the folder
 * itself (with stats) and its items list. Demo mode reuses the seed; remote
 * fetches both in parallel.
 */
export async function fetchFolderDetail(
  userId: string,
  kind: FolderKind,
): Promise<{ folder: FolderWithStats; items: Memory[] } | null> {
  if (isDemoMode) {
    const seed = getFolderSeed(kind);
    if (!seed) return null;
    const folder = seedToFolderWithStats(userId, seed);
    // Demo items are not full Memory rows — they don't carry srs/ids. The
    // folder detail screen tolerates that, but the wider app treats Memory
    // as authoritative. We synthesize the minimum shape per item so callers
    // can rely on the contract. Real Memory rows arrive from Supabase in
    // remote mode.
    const now = new Date();
    const items: Memory[] = seed.items.map((it, i) => ({
      id: `demo-${kind}-${i}`,
      userId,
      folderId: folder.id,
      term: it.front,
      reading: it.reading ?? null,
      definition: it.back,
      example: null,
      itemType: null,
      state: it.state,
      srs: { intervalDays: 0, easeFactor: 2.5, repetitions: 0 },
      // The seed stores the already-formatted label ("2 days ago"). Round-
      // trip it through isoFromRelativeLabel so relativeReviewed in the UI
      // reproduces the same label — otherwise demo rows would all show
      // "Never reviewed" once the adapter swaps to lastReviewedAt.
      lastReviewedAt: isoFromRelativeLabel(it.reviewed, now),
      nextReviewAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }));
    return { folder, items };
  }

  const folders = await fetchFoldersWithStats(userId);
  const folder = folders.find((f) => f.kind === kind);
  if (!folder) return null;
  const items = await fetchMemoriesForFolder(folder.id);
  return { folder, items };
}
