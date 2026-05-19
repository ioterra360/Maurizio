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
  kind: FolderKind | string;
  name: string;
  priority: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  userId: string;
  kind: FolderKind | string;
  name: string;
  priority: number;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    name: row.name,
    priority: row.priority,
    color: row.color,
    icon: row.icon,
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
  term: string;
  reading: string | null;
  definition: string;
  example: string | null;
  item_type: string | null;
  state: MemoryState;
  srs_interval_days: number;
  srs_ease_factor: number | string; // numeric(3,2) — JS may receive as string
  srs_repetitions: number;
  last_reviewed_at: string | null;
  next_review_at: string;
  created_at: string;
  updated_at: string;
};

export type Memory = {
  id: string;
  userId: string;
  folderId: string;
  term: string;
  reading: string | null;
  definition: string;
  example: string | null;
  itemType: string | null;
  state: MemoryState;
  srs: {
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
  };
  lastReviewedAt: string | null;
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
};

export function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    term: row.term,
    reading: row.reading,
    definition: row.definition,
    example: row.example,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
