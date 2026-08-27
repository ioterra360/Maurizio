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
 * Add functions feature-by-feature as Phase 2/3 lands.
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
  type ReviewItem,
  type ReviewItemRow,
  type ReviewSession,
  type ReviewSessionRow,
  mapFolder,
  mapMemory,
  mapProfile,
  mapReviewItem,
  mapReviewSession,
} from "./mappers";
import { FOLDER_TEMPLATES, type FolderKind, type ReviewResponse } from "./constants";
import type { DeletionPreview } from "./account-deletion";
import { getAllFolderSeeds, getFolderSeed, type FolderSeed } from "./folder-data";
import { nextFolderPriority, type NewFolderInput } from "./folder-templates";
import { isoFromRelativeLabel } from "./format";
import { DEMO_DUE_COUNTS, type LayerCounts } from "./queue";
import type { LayerKey } from "@/theme/tokens";
import { initialSrsState, type UpdatedSrs } from "@/features/srs/types";

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
// Account
// ---------------------------------------------------------------------------

/**
 * What the "Elimina account" sheet will wipe: how many memories and folders
 * the user owns. Two `head` count queries (no rows transferred). Demo mode:
 * the seed counts, so the sheet copy reads naturally during UI review.
 */
export async function fetchDeletionPreview(userId: string): Promise<DeletionPreview> {
  if (isDemoMode) {
    const seeds = getAllFolderSeeds();
    return {
      memories: seeds.reduce((sum, s) => sum + s.count, 0),
      folders: seeds.length,
    };
  }
  const [foldersRes, memoriesRes] = await Promise.all([
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (foldersRes.error) throw foldersRes.error;
  if (memoriesRes.error) throw memoriesRes.error;
  return { memories: memoriesRes.count ?? 0, folders: foldersRes.count ?? 0 };
}

/**
 * Delete the signed-in user's account — auth.users row plus everything that
 * cascades from it (profile, folders, memories, review history, sessions).
 * Runs through the `delete_own_account()` SECURITY DEFINER function
 * (migration 20260825152550): the target is always auth.uid(), the client
 * never holds service_role. Raises 42501 when there is no valid session.
 *
 * The caller must still `signOut()` afterwards to clear SecureStore — the
 * server-side session is already dead when this resolves.
 *
 * Demo mode: nothing to delete (no backend); the caller signs out as usual.
 */
export async function deleteOwnAccount(): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function fetchFolders(userId: string): Promise<Folder[]> {
  if (isDemoMode) {
    // Demo accounts keep all four template folders so the offline UI stays
    // fully reviewable. Real users start with ONE folder (see createFolder).
    return FOLDER_TEMPLATES.map((t, i) => ({
      id: `demo-folder-${i}`,
      userId,
      kind: t.kind,
      name: t.name,
      priority: i + 1,
      color: null,
      icon: null,
      paused: false,
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
 * How many folders the user owns. Drives the "must pick a topic" guard on
 * Add / Knowledge and the skip logic on /choose-topic. Demo: the four
 * template folders.
 */
export async function countFolders(userId: string): Promise<number> {
  if (isDemoMode) return FOLDER_TEMPLATES.length;
  const { count, error } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Create ONE folder for the user — the onboarding topic pick (a template
 * or a custom name, see lib/folder-templates.ts). Priority = max+1 of the
 * folders the user already has, read in the same call.
 *
 * `itemTypes` are NOT persisted: the folders table has no item_types
 * column and Add derives the chips from `kind` (ITEM_TYPES_BY_KIND). The
 * field travels in NewFolderInput so a future column is a one-line change.
 *
 * RLS: folders_all_own_or_admin lets an authenticated user insert rows
 * where user_id = auth.uid(). unique(user_id, kind) means a second folder
 * of the same kind fails with 23505 — the freemium flow never gets there
 * (one folder per free account), Premium will pick distinct kinds.
 *
 * Demo: returns a synthetic row, nothing stored.
 */
export async function createFolder(
  userId: string,
  input: NewFolderInput,
): Promise<Folder> {
  const now = new Date().toISOString();
  if (isDemoMode) {
    return {
      id: `demo-folder-${input.kind}`,
      userId,
      kind: input.kind,
      name: input.name,
      priority: 1,
      color: null,
      icon: null,
      paused: false,
      createdAt: now,
      updatedAt: now,
    };
  }
  const existing = await fetchFolders(userId);
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      kind: input.kind,
      name: input.name,
      priority: nextFolderPriority(existing),
    })
    .select("*")
    .single<FolderRow>();
  if (error) throw error;
  return mapFolder(data);
}

/**
 * Rename a folder. Demo mode is a no-op — demo folders are rebuilt from
 * FOLDER_TEMPLATES on every fetch, so a rename could never stick anyway.
 */
export async function updateFolderName(folderId: string, name: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.from("folders").update({ name }).eq("id", folderId);
  if (error) throw error;
}

/** Attiva/disattiva la pausa di una cartella. Demo no-op. */
export async function updateFolderPaused(folderId: string, paused: boolean): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.from("folders").update({ paused }).eq("id", folderId);
  if (error) throw error;
}

/** Elimina la cartella. I ricordi cascano a DB (on delete cascade). Demo no-op. */
export async function deleteFolder(folderId: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) throw error;
}

/** Ids delle cartelle in pausa dell'utente — usati per escluderle dalla coda. */
async function pausedFolderIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("paused", true);
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Range ISO [mezzanotte locale, ora] per il conteggio inserimenti di oggi. */
function todayRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from: from.toISOString(), to: now.toISOString() };
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

/**
 * One memory by id — the detail sheet (app/memory/[id].tsx). RLS limits the
 * read to the user's own rows. Demo: ids are `demo-<kind>-<i>` (see
 * fetchFolderDetail), so the row is rebuilt from the folder seed.
 */
export async function fetchMemoryById(id: string): Promise<Memory | null> {
  if (isDemoMode) {
    const m = /^demo-([a-z]+)-(\d+)$/.exec(id);
    if (!m) return null;
    const detail = await fetchFolderDetail("demo", m[1] as FolderKind);
    return detail?.items.find((it) => it.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("id", id)
    .maybeSingle<MemoryRow>();
  if (error) throw error;
  return data ? mapMemory(data) : null;
}

/**
 * Delete a memory for good. review_items rows cascade (FK on delete
 * cascade); RLS limits it to the user's own rows. Demo: no-op.
 */
export async function deleteMemory(id: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.from("memories").delete().eq("id", id);
  if (error) throw error;
}

/** Save the user's notes on a memory (null clears them). Demo: no-op. */
export async function updateMemoryNotes(id: string, notes: string | null): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("memories")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Crea un ricordo con lo stato SRS iniziale ESPLICITO da initialSrsState()
 * (il default DB di srs_interval_days è 1, non 0 — non fidarsi dei default
 * per i campi che l'algoritmo legge). next_review_at = now(): entra subito
 * in coda — il toast "primo ripasso domani" è framing UX (docs/SRS.md).
 * Demo: no-op → null.
 */
export async function createMemory(input: {
  userId: string;
  folderId: string;
  term: string;
  reading?: string;
  definition: string;
  example?: string;
  itemType?: string;
}): Promise<Memory | null> {
  if (isDemoMode) return null;
  const srs = initialSrsState();
  const { data, error } = await supabase
    .from("memories")
    .insert({
      user_id: input.userId,
      folder_id: input.folderId,
      term: input.term,
      reading: input.reading ?? null,
      definition: input.definition,
      example: input.example ?? null,
      item_type: input.itemType ?? null,
      srs_interval_days: srs.intervalDays,
      srs_ease_factor: srs.easeFactor,
      srs_repetitions: srs.repetitions,
      last_reviewed_at: srs.lastReviewedAt,
      next_review_at: srs.nextReviewAt,
    })
    .select("*")
    .single<MemoryRow>();
  if (error) throw error;
  return mapMemory(data);
}

/** Ricordi inseriti oggi (giorno locale) — per il limite giornaliero. */
export async function fetchTodayInputCount(userId: string): Promise<number> {
  if (isDemoMode) return 0;
  const { from, to } = todayRange();
  const { count, error } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", from)
    .lte("created_at", to);
  if (error) throw error;
  return count ?? 0;
}

/** Quanti ricordi contiene una cartella — per la conferma di eliminazione. */
export async function countMemoriesInFolder(folderId: string): Promise<number> {
  if (isDemoMode) return 0;
  const { count, error } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId);
  if (error) throw error;
  return count ?? 0;
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
    paused: false,
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
 * Roll a folder's memories up into FolderWithStats. Shared by the Knowledge
 * list (fetchFoldersWithStats) and the folder detail screen so the hero
 * stats always come from the same read as the items they describe.
 */
function rollupStats(folder: Folder, items: Memory[]): FolderWithStats {
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
}

/**
 * Folders + per-folder retention stats. The hot read for Knowledge, Today,
 * and the folder detail hero. Returns folders ordered by `priority`.
 *
 * Demo mode reads from the shared folder-data seed so the offline UI shows
 * the same numbers as the rest of the design contract. Remote mode joins
 * folders against memories and rolls up `state` counts in JS — that's one
 * folders query + N memories queries; cheap at one-to-few folders, and we
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
      return rollupStats(folder, items);
    }),
  );
  return enriched.sort((a, b) => a.priority - b.priority);
}

/**
 * The data the folder detail screen needs: the folder itself (with stats)
 * and its items list. Demo mode reuses the seed; remote resolves the folder
 * row, then fetches its items once and rolls up stats from that same read —
 * 2 queries total, and the hero stats always match the visible rows.
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

  const folders = await fetchFolders(userId);
  const folder = folders.find((f) => f.kind === kind);
  if (!folder) return null;
  const items = await fetchMemoriesForFolder(folder.id);
  return { folder: rollupStats(folder, items), items };
}

// ---------------------------------------------------------------------------
// Review sessions + items + scheduled-update persistence (Phase 3 step C)
// ---------------------------------------------------------------------------

/**
 * Start a review session and return the persisted row (with id). In demo
 * mode we return a synthetic local row so the rest of the flow gets the
 * same shape — the review store will use the id as a stable token to tag
 * subsequent recordReviewItem calls.
 */
export async function startReviewSession(
  userId: string,
  layer: LayerKey,
): Promise<ReviewSession> {
  const startedAt = new Date().toISOString();
  if (isDemoMode) {
    return {
      id: `demo-session-${layer}-${Date.now()}`,
      userId,
      layer,
      startedAt,
      completedAt: null,
      counts: { reviewed: 0, remembered: 0, struggled: 0, forgot: 0 },
    };
  }
  const { data, error } = await supabase
    .from("review_sessions")
    .insert({ user_id: userId, layer, started_at: startedAt })
    .select("*")
    .single<ReviewSessionRow>();
  if (error) throw error;
  return mapReviewSession(data);
}

/**
 * Record one card recall in the active session. Fire-and-forget from the
 * caller's perspective — we still throw on remote errors so the store can
 * surface a toast, but we don't block the UI on the round-trip.
 */
export async function recordReviewItem(opts: {
  sessionId: string;
  memoryId: string;
  userId: string;
  response: ReviewResponse;
  reviewedAt?: string;
}): Promise<ReviewItem | null> {
  if (isDemoMode) return null;
  const { data, error } = await supabase
    .from("review_items")
    .insert({
      session_id: opts.sessionId,
      memory_id: opts.memoryId,
      user_id: opts.userId,
      response: opts.response,
      reviewed_at: opts.reviewedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single<ReviewItemRow>();
  if (error) throw error;
  return mapReviewItem(data);
}

/**
 * Close out a review session with the final counts. Demo no-ops.
 */
export async function completeReviewSession(
  sessionId: string,
  counts: { reviewed: number; remembered: number; struggled: number; forgot: number },
): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("review_sessions")
    .update({
      completed_at: new Date().toISOString(),
      items_reviewed: counts.reviewed,
      items_remembered: counts.remembered,
      items_struggled: counts.struggled,
      items_forgot: counts.forgot,
    })
    .eq("id", sessionId);
  if (error) throw error;
}

/**
 * Persist the scheduler's UpdatedSrs back to the memories row. Demo no-ops.
 * The mapping is straightforward — UpdatedSrs already lines up 1:1 with the
 * srs_* columns plus the lifecycle state.
 */
export async function applyScheduledUpdate(
  memoryId: string,
  srs: UpdatedSrs,
): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("memories")
    .update({
      srs_interval_days: srs.intervalDays,
      srs_ease_factor: srs.easeFactor,
      srs_repetitions: srs.repetitions,
      last_reviewed_at: srs.lastReviewedAt,
      next_review_at: srs.nextReviewAt,
      state: srs.state,
    })
    .eq("id", memoryId);
  if (error) throw error;
}

/**
 * Due memories sliced by layer, per docs/SRS.md:
 *   - scan          : due now, srs_repetitions < 3
 *   - reinforcement : due now, 3 <= srs_repetitions < 8, OR state='fading'
 *   - focus         : due now, srs_repetitions >= 8
 *
 * Demo mode returns an empty list — the review store falls through to its
 * static decks for offline UAT. Phase 3D will replace the static decks
 * with this query.
 */
export async function fetchDueMemoriesByLayer(
  userId: string,
  layer: LayerKey,
  opts: { folderId?: string; limit?: number } = {},
): Promise<Memory[]> {
  if (isDemoMode) return [];
  const limit = opts.limit ?? 30;
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .neq("state", "archived")
    .lte("next_review_at", nowIso);
  if (opts.folderId) {
    query = query.eq("folder_id", opts.folderId);
  } else {
    // Le cartelle in pausa escono dalla coda globale. Una sessione scoped
    // (folderId esplicito) invece le può ripassare comunque.
    const paused = await pausedFolderIds(userId);
    if (paused.length > 0) query = query.not("folder_id", "in", `(${paused.join(",")})`);
  }

  // The layer predicates MUST be mutually exclusive so that during the full
  // Scan → Reinforcement → Focus flow no memory shows up twice. Per
  // docs/SRS.md fading items belong to Reinforcement only; Scan and Focus
  // exclude them explicitly.
  if (layer === "scan") {
    query = query.lt("srs_repetitions", 3).neq("state", "fading");
  } else if (layer === "reinforcement") {
    // Either in the reinforcement repetition window OR explicitly fading.
    query = query.or("and(srs_repetitions.gte.3,srs_repetitions.lt.8),state.eq.fading");
  } else {
    query = query.gte("srs_repetitions", 8).neq("state", "fading");
  }

  const { data, error } = await query
    .order("next_review_at")
    .limit(limit)
    .returns<MemoryRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMemory);
}

/**
 * Conteggi della coda per livello — per il piano reattivo di Oggi e per la
 * ripartizione del budget. Stessi predicati (mutuamente esclusivi) di
 * fetchDueMemoriesByLayer. Demo: dimensioni dei mazzi statici.
 */
export async function fetchDueCounts(
  userId: string,
  folderId?: string,
): Promise<LayerCounts> {
  if (isDemoMode) return { ...DEMO_DUE_COUNTS };
  const nowIso = new Date().toISOString();
  const paused = folderId ? [] : await pausedFolderIds(userId);
  const base = () => {
    let q = supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("state", "archived")
      .lte("next_review_at", nowIso);
    if (folderId) q = q.eq("folder_id", folderId);
    else if (paused.length > 0) q = q.not("folder_id", "in", `(${paused.join(",")})`);
    return q;
  };
  const [scan, reinforcement, focus] = await Promise.all(
    [
      base().lt("srs_repetitions", 3).neq("state", "fading"),
      base().or("and(srs_repetitions.gte.3,srs_repetitions.lt.8),state.eq.fading"),
      base().gte("srs_repetitions", 8).neq("state", "fading"),
    ].map(async (q) => {
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    }),
  );
  return { scan, reinforcement, focus };
}
