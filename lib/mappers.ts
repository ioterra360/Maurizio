/**
 * DB row <-> frontend model mappers.
 *
 * Pattern borrowed from the TLC mobile project: every Supabase response
 * passes through a mapper before reaching React. This isolates two concerns:
 *   1. snake_case (DB) vs camelCase (TS) translation
 *   2. handling nullable / partial columns with safe defaults
 *
 * Rule: NO component imports from supabase-js directly. Components import
 * from lib/api.ts, which calls these mappers internally.
 */

import type { FolderKind, MemoryState, ReviewResponse } from "./constants";
import type { PhaseState, ReviewPhase } from "@/features/srs/phases";
import { LEGACY_KIND_TO_TEMPLATE, type FolderCategory } from "./folder-taxonomy";

// ============================================================================
// Profile
// ============================================================================

export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  daily_input_cap: number;
  calm_mode: boolean;
  weekly_digest: boolean;
  morning_review_at: string;
  evening_review_at: string;
  /** Eliminazione account richiesta (migration 20260830121000); null = attivo. */
  deletion_requested_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  dailyInputCap: number;
  calmMode: boolean;
  weeklyDigest: boolean;
  morningReviewAt: string;
  eveningReviewAt: string;
  /** Eliminazione account richiesta; null = attivo. */
  deletionRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    dailyInputCap: row.daily_input_cap,
    calmMode: row.calm_mode,
    weeklyDigest: row.weekly_digest,
    morningReviewAt: row.morning_review_at,
    eveningReviewAt: row.evening_review_at,
    deletionRequestedAt: row.deletion_requested_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Folder
// ============================================================================

export type FolderRow = {
  id: string;
  user_id: string;
  /** LEGACY: colonna ponte per i client vecchi (migration 20260902130000). */
  kind: FolderKind | string;
  name: string;
  priority: number;
  /** Macrocategoria della tassonomia; null solo su righe pre-migrazione. */
  category?: FolderCategory | null;
  /** Sottocategoria scelta alla creazione; null = personalizzata. */
  template_id?: string | null;
  /** Glifo del FolderTile. */
  emoji?: string | null;
  color: string | null;
  icon: string | null;
  paused: boolean;
  /** Nel cestino da questo istante; null = viva (migration 20260830120000). */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  userId: string;
  /** LEGACY: solo per compatibilità col periodo di transizione. Non usarla per logica nuova. */
  kind: FolderKind | string;
  name: string;
  priority: number;
  /** Macrocategoria della tassonomia (lingue/materie/lavoro/interessi/custom). */
  category: FolderCategory;
  /** Sottocategoria (es. ja, medicina, vino); null = personalizzata. */
  templateId: string | null;
  /** Glifo del FolderTile. Sempre presente: fallback dal kind legacy. */
  emoji: string;
  color: string | null;
  icon: string | null;
  paused: boolean;
  /** Nel cestino da questo istante; null = viva. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapFolder(row: FolderRow): Folder {
  // Riga pre-migrazione letta da un client nuovo: deriva dal kind legacy.
  const legacy = LEGACY_KIND_TO_TEMPLATE[row.kind] ?? LEGACY_KIND_TO_TEMPLATE.custom;
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    name: row.name,
    priority: row.priority,
    category: row.category ?? legacy.category,
    templateId: row.template_id ?? legacy.templateId,
    emoji: row.emoji ?? legacy.emoji,
    color: row.color,
    icon: row.icon,
    paused: row.paused,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Folder + aggregate retention stats. Used by the Knowledge list, Today
 * recommendations, and the folder detail header. The stats are server-side
 * aggregates in Phase 3 (one round-trip per render of these screens) and
 * derived from the demo seed when running offline.
 *
 * Percentages are normalized 0-100 and round to integers in the mapper so
 * the UI never has to think about float drift.
 */
export type FolderWithStats = Folder & {
  count: number;
  /** Active items as a percentage of `count`, integer 0-100. */
  active: number;
  /** Fading items as a percentage of `count`, integer 0-100. */
  fading: number;
  /** Archived items as a percentage of `count`, integer 0-100. */
  archived: number;
  addedThisWeek: number;
};

// ============================================================================
// Subfolder (sezioni dentro una cartella — migration 20260831010000)
// ============================================================================

export type SubfolderRow = {
  id: string;
  user_id: string;
  folder_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Subfolder = {
  id: string;
  userId: string;
  folderId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export function mapSubfolder(row: SubfolderRow): Subfolder {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Memory
// ============================================================================

export type MemoryRow = {
  id: string;
  user_id: string;
  folder_id: string;
  /** Sezione della cartella (subfolders.id); null = radice. */
  subfolder_id?: string | null;
  term: string;
  reading: string | null;
  definition: string;
  example: string | null;
  /** Free-text user notes ("appunti"); column added 2026-08-27. */
  notes?: string | null;
  item_type: string | null;
  state: MemoryState;
  srs_interval_days: number;
  srs_ease_factor: number | string; // numeric(3,2) — JS may receive as string
  srs_repetitions: number;
  last_reviewed_at: string | null;
  next_review_at: string;
  /** Fase della scala (migration 20260902100000). Opzionale: le righe lette da un client vecchio non ce l'hanno. */
  review_phase?: ReviewPhase | null;
  review_window_end?: string | null;
  recovery_from?: ReviewPhase | null;
  last_result?: string | null;
  /** Nel cestino da questo istante; null = vivo (migration 20260830120000). */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Memory = {
  id: string;
  userId: string;
  folderId: string;
  /** Sezione della cartella; null = radice. */
  subfolderId: string | null;
  term: string;
  reading: string | null;
  definition: string;
  example: string | null;
  /** Free-text user notes ("appunti"), edited in the memory detail sheet. */
  notes?: string | null;
  itemType: string | null;
  state: MemoryState;
  srs: {
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
  };
  lastReviewedAt: string | null;
  nextReviewAt: string;
  /** Fase della scala di Maurizio. Decide il layer di ripasso. */
  phase: ReviewPhase;
  /** Fine finestra; oltre questa il ricordo è in ritardo. null = non scade. */
  reviewWindowEnd: string | null;
  /** Fase da cui viene il recupero in corso; null = non in recupero. */
  recoveryFrom: ReviewPhase | null;
  /** Nel cestino da questo istante; null = vivo. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    subfolderId: row.subfolder_id ?? null,
    term: row.term,
    reading: row.reading,
    definition: row.definition,
    example: row.example,
    notes: row.notes ?? null,
    itemType: row.item_type,
    state: row.state,
    srs: {
      intervalDays: row.srs_interval_days,
      easeFactor: typeof row.srs_ease_factor === "string"
        ? parseFloat(row.srs_ease_factor)
        : row.srs_ease_factor,
      repetitions: row.srs_repetitions,
    },
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    phase: row.review_phase ?? "p20h",
    reviewWindowEnd: row.review_window_end ?? null,
    recoveryFrom: row.recovery_from ?? null,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Memory → lo stato che features/srs/phases si aspetta. */
export function toPhaseState(m: Memory): PhaseState {
  return {
    phase: m.phase,
    nextReviewAt: m.nextReviewAt,
    reviewWindowEnd: m.reviewWindowEnd,
    recoveryFrom: m.recoveryFrom,
    lastReviewedAt: m.lastReviewedAt,
  };
}

// ============================================================================
// Review session + items
// ============================================================================

export type ReviewSessionRow = {
  id: string;
  user_id: string;
  layer: "scan" | "reinforcement" | "focus";
  started_at: string;
  completed_at: string | null;
  items_reviewed: number;
  items_remembered: number;
  items_struggled: number;
  items_forgot: number;
};

export type ReviewSession = {
  id: string;
  userId: string;
  layer: "scan" | "reinforcement" | "focus";
  startedAt: string;
  completedAt: string | null;
  counts: {
    reviewed: number;
    remembered: number;
    struggled: number;
    forgot: number;
  };
};

export function mapReviewSession(row: ReviewSessionRow): ReviewSession {
  return {
    id: row.id,
    userId: row.user_id,
    layer: row.layer,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    counts: {
      reviewed: row.items_reviewed,
      remembered: row.items_remembered,
      struggled: row.items_struggled,
      forgot: row.items_forgot,
    },
  };
}

export type ReviewItemRow = {
  id: string;
  session_id: string;
  memory_id: string;
  user_id: string;
  response: ReviewResponse;
  reviewed_at: string;
};

export type ReviewItem = {
  id: string;
  sessionId: string;
  memoryId: string;
  userId: string;
  response: ReviewResponse;
  reviewedAt: string;
};

export function mapReviewItem(row: ReviewItemRow): ReviewItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    memoryId: row.memory_id,
    userId: row.user_id,
    response: row.response,
    reviewedAt: row.reviewed_at,
  };
}
