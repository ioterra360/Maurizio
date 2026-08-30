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
import {
  FOLDER_TEMPLATES,
  LAYER_REPS_FOCUS_BELOW,
  LAYER_REPS_REINFORCEMENT_BELOW,
  type FolderKind,
  type ReviewResponse,
} from "./constants";
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
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
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

/**
 * Richiede l'eliminazione dell'account con 72 ore di grazia (migration
 * 20260830121000): profiles.deletion_requested_at = now(), i dati restano.
 * Il chiamante fa signOut(); riaccedendo entro 72 ore l'app propone il
 * recupero (cancelAccountDeletion). La purga definitiva è un job server
 * (purge_expired_accounts). Sostituisce deleteOwnAccount nel flusso UI.
 */
export async function requestAccountDeletion(): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) throw error;
}

/** Annulla l'eliminazione richiesta — "Recupera account". Demo no-op. */
export async function cancelAccountDeletion(): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) throw error;
}

/**
 * Quando è stata richiesta l'eliminazione dell'account (null = mai). Letta
 * al login/mount dell'app per portare l'utente su /recover-account.
 */
export async function fetchDeletionRequestedAt(userId: string): Promise<string | null> {
  if (isDemoMode) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("deletion_requested_at")
    .eq("id", userId)
    .maybeSingle<{ deletion_requested_at: string | null }>();
  if (error) throw error;
  return data?.deletion_requested_at ?? null;
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
      deletedAt: null,
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
    .is("deleted_at", null)
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
    .eq("user_id", userId)
    .is("deleted_at", null);
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
      deletedAt: null,
      color: null,
      icon: null,
      paused: false,
      createdAt: now,
      updatedAt: now,
    };
  }
  const existing = await fetchFolders(userId);
  // unique(user_id, kind): una cartella della stessa kind ancora nel cestino
  // occuperebbe lo slot (23505). MAI hard delete (tradirebbe la promessa
  // delle 24 ore — review 2026-08-30): la riga nel cestino viene RIANIMATA
  // col nuovo nome, e i suoi vecchi ricordi restano nel cestino con la loro
  // finestra (in /trash compaiono come ricordi singoli, ripristinabili).
  const { data: trashed, error: trashedError } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", input.kind)
    .not("deleted_at", "is", null)
    .maybeSingle<{ id: string }>();
  if (trashedError) throw trashedError;
  if (trashed) {
    const { data: revived, error: reviveError } = await supabase
      .from("folders")
      .update({
        deleted_at: null,
        name: input.name,
        priority: nextFolderPriority(existing),
        paused: false,
      })
      .eq("id", trashed.id)
      .select("*")
      .single<FolderRow>();
    if (reviveError) throw reviveError;
    return mapFolder(revived);
  }
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

/**
 * Scrive l'ordine delle cartelle scelto in Cartelle (1 = più in alto) in
 * folders.priority, così il mazzo di Oggi e gli altri dispositivi lo
 * seguono. Al massimo 5 cartelle per utente: un update ciascuna. Demo no-op.
 */
export async function updateFolderPriorities(
  pairs: ReadonlyArray<{ id: string; priority: number }>,
): Promise<void> {
  if (isDemoMode) return;
  await Promise.all(
    pairs.map(async ({ id, priority }) => {
      const { error } = await supabase.from("folders").update({ priority }).eq("id", id);
      if (error) throw error;
    }),
  );
}

/**
 * Sposta la cartella nel cestino (deleted_at) insieme ai suoi ricordi vivi.
 * La purga definitiva avviene dopo 24 ore lato server (purge_trash).
 * I ricordi PRIMA della cartella: se il secondo update fallisce resta una
 * cartella visibile con ricordi nel cestino (recuperabili), mai il contrario
 * — una cartella nascosta con ricordi vivi verrebbe mangiata dal cascade
 * della purga. Demo no-op.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  if (isDemoMode) return;
  const deletedAt = new Date().toISOString();
  const { error: memError } = await supabase
    .from("memories")
    .update({ deleted_at: deletedAt })
    .eq("folder_id", folderId)
    .is("deleted_at", null);
  if (memError) throw memError;
  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: deletedAt })
    .eq("id", folderId);
  if (error) throw error;
}

/** Ids delle cartelle in pausa dell'utente — usati per escluderle dalla coda. */
async function pausedFolderIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("paused", true)
    .is("deleted_at", null);
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
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .maybeSingle<MemoryRow>();
  if (error) throw error;
  return data ? mapMemory(data) : null;
}

/**
 * Sposta il ricordo nel cestino (deleted_at); la storia di ripasso resta e
 * cade solo con la purga definitiva dopo 24 ore (purge_trash). Demo: no-op.
 */
export async function deleteMemory(id: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("memories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
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

/**
 * Ricordi inseriti oggi (giorno locale) — per il limite giornaliero.
 * NESSUN filtro sul cestino, di proposito: eliminare e reinserire non deve
 * liberare quota.
 */
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
    .eq("folder_id", folderId)
    .is("deleted_at", null);
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
    .is("deleted_at", null)
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
    deletedAt: null,
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
      deletedAt: null,
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
 * Quante volte questo ricordo è stato ripassato davvero: righe di
 * review_items (una per risposta registrata). NON srs_repetitions, che è la
 * striscia di successi SM-2 e torna a 0 dopo un "non ricordo" (review
 * 2026-08-30). Demo: 0.
 */
export async function fetchReviewCount(memoryId: string): Promise<number> {
  if (isDemoMode) return 0;
  const { count, error } = await supabase
    .from("review_items")
    .select("id", { count: "exact", head: true })
    .eq("memory_id", memoryId);
  if (error) throw error;
  return count ?? 0;
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
 *   - focus         : due now, srs_repetitions < LAYER_REPS_FOCUS_BELOW (2)
 *   - reinforcement : due now, 2 <= srs_repetitions < LAYER_REPS_REINFORCEMENT_BELOW (4), OR state='fading'
 *   - scan          : due now, srs_repetitions >= 4
 * Rationale + Maurizio's phase mapping in lib/constants.ts; pure mirror in
 * lib/queue.ts layerFor().
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
    .is("deleted_at", null)
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
  if (layer === "focus") {
    query = query.lt("srs_repetitions", LAYER_REPS_FOCUS_BELOW).neq("state", "fading");
  } else if (layer === "reinforcement") {
    // Either in the reinforcement repetition window OR explicitly fading.
    query = query.or(
      `and(srs_repetitions.gte.${LAYER_REPS_FOCUS_BELOW},srs_repetitions.lt.${LAYER_REPS_REINFORCEMENT_BELOW}),state.eq.fading`,
    );
  } else {
    query = query.gte("srs_repetitions", LAYER_REPS_REINFORCEMENT_BELOW).neq("state", "fading");
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
      .is("deleted_at", null)
      .neq("state", "archived")
      .lte("next_review_at", nowIso);
    if (folderId) q = q.eq("folder_id", folderId);
    else if (paused.length > 0) q = q.not("folder_id", "in", `(${paused.join(",")})`);
    return q;
  };
  const [scan, reinforcement, focus] = await Promise.all(
    [
      base().gte("srs_repetitions", LAYER_REPS_REINFORCEMENT_BELOW).neq("state", "fading"),
      base().or(
        `and(srs_repetitions.gte.${LAYER_REPS_FOCUS_BELOW},srs_repetitions.lt.${LAYER_REPS_REINFORCEMENT_BELOW}),state.eq.fading`,
      ),
      base().lt("srs_repetitions", LAYER_REPS_FOCUS_BELOW).neq("state", "fading"),
    ].map(async (q) => {
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    }),
  );
  return { scan, reinforcement, focus };
}

// ---------------------------------------------------------------------------
// Cestino (soft delete — migration 20260830120000, purga server dopo 24 ore)
// ---------------------------------------------------------------------------

export type TrashFolder = Folder & { memoryCount: number };
export type TrashMemory = Memory & { folderName: string | null };
export type TrashContent = { folders: TrashFolder[]; memories: TrashMemory[] };

/**
 * Contenuto del cestino: cartelle eliminate (con quanti ricordi contengono)
 * e ricordi eliminati singolarmente (la cui cartella è viva), col nome della
 * cartella. Due letture sequenziali: tutte le cartelle (vive e no, servono i
 * nomi) e i ricordi nel cestino; la partizione avviene in JS.
 */
export async function fetchTrash(userId: string): Promise<TrashContent> {
  if (isDemoMode) return { folders: [], memories: [] };
  const foldersRes = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .returns<FolderRow[]>();
  if (foldersRes.error) throw foldersRes.error;
  const memoriesRes = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at")
    .returns<MemoryRow[]>();
  if (memoriesRes.error) throw memoriesRes.error;

  const folders = (foldersRes.data ?? []).map(mapFolder);
  const trashedFolders = folders.filter((f) => f.deletedAt);
  const trashedIds = new Set(trashedFolders.map((f) => f.id));
  const nameById = new Map(folders.map((f) => [f.id, f.name]));
  const memories = (memoriesRes.data ?? []).map(mapMemory);

  // Un ricordo eliminato ben PRIMA della sua cartella scade per conto suo:
  // va mostrato come voce singola col suo countdown, non nel conteggio della
  // cartella (che scade più tardi). La tolleranza di un minuto tiene uniti
  // gli update dello stesso deleteFolder (due richieste, due now() server).
  const folderTs = new Map(trashedFolders.map((f) => [f.id, Date.parse(f.deletedAt ?? "")]));
  const inFolderBatch = (m: Memory): boolean => {
    const fts = folderTs.get(m.folderId);
    if (fts === undefined) return false;
    return fts - Date.parse(m.deletedAt ?? "") <= 60_000;
  };
  const counts = new Map<string, number>();
  for (const m of memories) {
    if (inFolderBatch(m)) counts.set(m.folderId, (counts.get(m.folderId) ?? 0) + 1);
  }
  return {
    folders: trashedFolders.map((f) => ({ ...f, memoryCount: counts.get(f.id) ?? 0 })),
    memories: memories
      .filter((m) => !inFolderBatch(m))
      .map((m) => ({ ...m, folderName: nameById.get(m.folderId) ?? null })),
  };
}

/**
 * Ripristina una cartella dal cestino, con tutti i suoi ricordi nel cestino
 * (anche quelli eliminati singolarmente prima della cartella — regola
 * comunicata: "ripristinandola tornano"). La cartella PRIMA dei ricordi:
 * mai ricordi vivi dentro una cartella nascosta.
 */
export async function restoreFolder(folderId: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: null })
    .eq("id", folderId);
  if (error) throw error;
  const { error: memError } = await supabase
    .from("memories")
    .update({ deleted_at: null })
    .eq("folder_id", folderId)
    .not("deleted_at", "is", null);
  if (memError) throw memError;
}

/**
 * Ripristina un singolo ricordo. Se la sua cartella è nel cestino torna
 * anche LEI (solo la riga cartella: gli altri ricordi restano nel cestino
 * fino a purga o ripristino esplicito) — senza questo, la purga della
 * cartella si porterebbe via il ricordo appena ripristinato (cascade).
 */
export async function restoreMemory(id: string): Promise<void> {
  if (isDemoMode) return;
  const { data, error } = await supabase
    .from("memories")
    .select("id, folder_id")
    .eq("id", id)
    .maybeSingle<{ id: string; folder_id: string }>();
  if (error) throw error;
  if (!data) return;
  // Cartella PRIMA del ricordo: se il secondo update fallisce resta un
  // ricordo nel cestino dentro una cartella viva (stato sicuro), mai un
  // ricordo vivo in una cartella nascosta che il cascade della purga si
  // porterebbe via (review 2026-08-30; il trigger memories_guard_deleted_at
  // rifiuta comunque l'ordine inverso).
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, deleted_at")
    .eq("id", data.folder_id)
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (folderError) throw folderError;
  if (folder?.deleted_at) {
    const { error: restoreError } = await supabase
      .from("folders")
      .update({ deleted_at: null })
      .eq("id", folder.id);
    if (restoreError) throw restoreError;
  }
  const { error: updError } = await supabase
    .from("memories")
    .update({ deleted_at: null })
    .eq("id", id);
  if (updError) throw updError;
}
