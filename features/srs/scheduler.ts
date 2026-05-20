/**
 * SM-2 scheduler — adapted to Memora's three-layer outcome model.
 *
 * Pure function: same inputs → same output. No React, no Supabase, no I/O.
 * The persistence layer (lib/api.ts) and the review store call this and
 * then write the result back to the DB.
 *
 * Spec: docs/SRS.md. The mapping from layer outcomes to SM-2 quality and
 * the update formula are reproduced inline so this file is readable on its
 * own — if you ever rev the spec, edit there first then mirror here.
 */

import {
  DEFAULT_EASE,
  FADING_OVERDUE_MULTIPLIER,
  MIN_EASE,
  type LayerOutcome,
  type MemoryLifecycleState,
  type Quality,
  type SrsState,
  type UpdatedSrs,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Map a layer outcome to a 5-point SM-2 quality. Locked by docs/SRS.md.
 */
export function qualityFor(outcome: LayerOutcome): Quality {
  switch (outcome.layer) {
    case "scan":
      return outcome.outcome === "remember" ? 4 : 2;
    case "reinforcement":
      return outcome.outcome === "continue" ? 4 : 1;
    case "focus":
      if (outcome.outcome === "remembered") return 5;
      if (outcome.outcome === "struggled") return 3;
      return 0;
  }
}

/**
 * Apply one review to an SRS state and return the next state.
 *
 * Notes:
 * - We round the next interval to whole days. Sub-day intervals would force
 *   timezone math we don't want in the scheduler — the queue layer already
 *   resolves "is this due today" against the user's morning_review_at.
 * - We never let easeFactor drop below MIN_EASE (1.3) — the SM-2 paper's
 *   floor; below it intervals stop growing meaningfully and the user just
 *   sees the same card forever.
 * - For Scan "Show me" (quality 2 → forget branch) we keep repetitions at 0
 *   but the lifecycle stays `active`; an actually-forgotten card is what the
 *   queue layer will surface again tomorrow.
 */
export function update(
  state: SrsState,
  outcome: LayerOutcome,
  now: Date = new Date(),
): UpdatedSrs {
  const q = qualityFor(outcome);
  let { intervalDays, easeFactor, repetitions } = state;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    easeFactor = Math.max(
      MIN_EASE,
      easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
    );
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * DAY_MS).toISOString();
  const lastReviewedAt = now.toISOString();
  const next: SrsState = { intervalDays, easeFactor, repetitions, nextReviewAt, lastReviewedAt };

  return {
    ...next,
    quality: q,
    // Lifecycle is derived from the PREVIOUS state, not the new one. After
    // a forget the new nextReviewAt is always in the future (tomorrow), so
    // it would always look "fresh"; what we actually want to know is "was
    // this card badly overdue before the user got back to it?".
    state: deriveLifecycleState(state, q, now),
  };
}

/**
 * Lifecycle state heuristic per docs/SRS.md:
 *   - active   while we're not overdue beyond a small grace window
 *   - fading   when overdue by > FADING_OVERDUE_MULTIPLIER × interval
 *   - archived is a user action only — never set by the scheduler
 *
 * `priorState` is the SrsState BEFORE applying the current outcome — its
 * `nextReviewAt` and `intervalDays` describe what was scheduled when the
 * user actually saw the card, which is what "overdue" should measure.
 */
export function deriveLifecycleState(
  priorState: SrsState,
  quality: Quality,
  now: Date = new Date(),
): MemoryLifecycleState {
  // A successful recall freshens the card by definition.
  if (quality >= 3) return "active";
  // Forget branch: only flag fading when the card had been waiting in the
  // queue far past its scheduled time. New cards (intervalDays === 0)
  // can't fade — they've never been reviewed yet.
  if (priorState.intervalDays <= 0) return "active";
  const due = new Date(priorState.nextReviewAt).getTime();
  const overdueMs = now.getTime() - due;
  const intervalMs = priorState.intervalDays * DAY_MS;
  if (overdueMs > intervalMs * FADING_OVERDUE_MULTIPLIER) return "fading";
  return "active";
}

/** Convenience for tests + onboarding — keeps DEFAULT_EASE in one place. */
export { DEFAULT_EASE, MIN_EASE };
