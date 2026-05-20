/**
 * SRS types — kept narrow so the scheduler stays a pure function.
 *
 * The scheduler does NOT depend on lib/mappers.Memory directly. It works on
 * SrsState (the four numbers the algorithm cares about) and a string id. The
 * persistence layer (lib/api.ts in step C) is responsible for round-tripping
 * the rest of the Memory row.
 */

import type { LayerKey } from "@/theme/tokens";

export type LayerOutcome =
  | { layer: "scan"; outcome: "remember" | "show" }
  | { layer: "reinforcement"; outcome: "continue" | "again" }
  | { layer: "focus"; outcome: "remembered" | "struggled" | "forgot" };

/**
 * The 5-point quality scale SM-2 expects. Higher = better recall.
 * Anything `< 3` is treated as a forget and resets the interval.
 */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export type SrsState = {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  /** ISO timestamp of when the memory should next surface in the queue. */
  nextReviewAt: string;
  /** ISO timestamp of when the memory was last reviewed (null on first ever). */
  lastReviewedAt: string | null;
};

export type MemoryLifecycleState = "active" | "fading" | "archived";

export type UpdatedSrs = SrsState & {
  /** SM-2 quality used for this update — useful for telemetry/replay. */
  quality: Quality;
  /** Lifecycle state derived from the new interval + history. */
  state: MemoryLifecycleState;
};

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const FADING_OVERDUE_MULTIPLIER = 1.5;

/** Default new-memory SRS state — what api.ts seeds rows with. */
export function initialSrsState(now: Date = new Date()): SrsState {
  return {
    intervalDays: 0,
    easeFactor: DEFAULT_EASE,
    repetitions: 0,
    nextReviewAt: now.toISOString(),
    lastReviewedAt: null,
  };
}

/** Re-export of LayerKey so callers don't have to dual-import from tokens. */
export type Layer = LayerKey;
