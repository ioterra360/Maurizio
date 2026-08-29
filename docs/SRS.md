# SRS — the review engine

> The algorithm that decides when each memory is due for review.
> Phase 3 deliverable. This doc captures intent now so we don't redesign later.

## Status

🚧 **Not implemented yet.** Phase 3.

The schema is in place (`memories.srs_*` columns), and the design is locked
below. The TypeScript implementation lives in `features/srs/scheduler.ts`
(to be created in Phase 3).

## What an SRS does, in one paragraph

For each memory, after each review, decide *when to ask again*. Make the
interval longer if the user remembered, shorter if they forgot. Tune via an
"ease factor" so memories that consistently come back stay on a comfortable
schedule, while difficult ones get caught more often. The result, applied
across thousands of items, is a queue that surfaces what is actually fading
without burying the user under everything they've ever learned.

## Choice of algorithm

Three serious candidates:

| Algorithm | Pros | Cons |
|---|---|---|
| **SM-2** (Anki classic) | Battle-tested, simple math, 5-button | Not personalized; same params for all users |
| **SM-17** (SuperMemo) | Personalized to recall difficulty | Proprietary, complex, overkill at this scale |
| **FSRS** (free open algorithm) | Personalized via Bayesian recall model | Recent, requires training data we don't have |

**Choice: start with SM-2.** We have zero recall data on day one — FSRS would
have nothing to train against. SM-2 gives us a working scheduler immediately.
We can revisit FSRS in Phase 5+ once we have months of user data.

## SM-2 adapted for our three layers

Vanilla SM-2 uses a 5-point quality scale (0-5). We collapse that to our
recall outcomes:

| Layer | Outcomes | SM-2 quality |
|---|---|---|
| Scan | Remember / Show me | 4 / 2 |
| Reinforcement | Continue / Review again | 4 / 1 |
| Focus | Remembered / Forgot | 5 / 0 |

Why these exact mappings:
- **Scan "Show me"** = "I couldn't recall it instantly" = mild forget (2).
  Memory stays in the active queue but interval doesn't grow much.
- **Reinforcement "Review again"** = the user explicitly asked for another
  pass = treat as a real failure (1) to surface again soon.
- Answers are binary on every layer. The intermediate "Struggled" (quality 3)
  was removed from the UI on 2026-08-29 (Maurizio): it needs its own timing
  and only makes sense for item types where a partial recall exists
  (concepts, not vocabulary). The scheduler still accepts quality 3 so it
  can return.
- **Focus "Forgot"** = full reset (0) — interval back to 1 day, repetitions zero.

## Update rules

After each review, given current `interval`, `ease`, `repetitions`, and the
quality `q ∈ [0, 5]`:

```
if q < 3:
  repetitions = 0
  interval    = 1
else:
  repetitions += 1
  interval = case repetitions:
    1 -> 1
    2 -> 6
    _ -> round(prev_interval * ease)
  ease = max(1.30, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
```

`next_review_at` is then `now() + interval days`.

`state` updates lazily based on time since last review and the interval:
- `active` while `next_review_at` is in the future or only mildly past due
- `fading` when overdue by > 1.5× the interval (heuristic, tuned later)
- `archived` is a user action (or auto after many consecutive forgets — TBD)

## When the recommended-flow CTA runs

"Start Today's Review" runs Scan → Reinforcement → Focus over a single bucket
of due memories, slicing them by layer:

- **Scan layer**: due memories with `srs_repetitions ≥ 4` — the 3-month
  phase and beyond ("ricordi più vecchi"). Fast pass.
- **Reinforcement layer**: due memories with `2 ≤ srs_repetitions < 4` or
  state = `fading` — the 7-day and 30-day phases. Guided recall, also the
  recovery path for fading cards.
- **Focus layer**: due memories with `srs_repetitions < 2` — the 20h and 48h
  consolidations ("ricordi di ieri"). Deep review. A forget resets
  repetitions, so a forgotten card drops back here.

Mapping fixed on 2026-08-29 from Maurizio's phase ladder (Focus for the two
consolidations, Reinforcement for 7d/30d, Scan from 3 months). The previous
rule was inverted (Scan for the newest cards). Thresholds live in
`lib/constants.ts` (`LAYER_REPS_*`), mirrored in `lib/api.ts` and
`lib/queue.ts layerFor()`.

The user can also tap a single layer card to run only that layer (no auto
hand-off to the next). Captured in `review_sessions.layer`.

## Time-budget chips

5 / 15 / 30 / 1 hr. They cap the number of memories per session, not the wall
clock. Approximations:

| Budget | Items |
|---|---|
| 5 min | 8-10 |
| 15 min | 25-30 |
| 30 min | 50-60 |
| 1 hr | 100-120 |

These are heuristics. We'll measure actual session length once we have
telemetry (Phase 4 Sentry breadcrumbs).

## Edge cases the design must handle

- **First review ever.** New memories default to `next_review_at = now()`,
  so they enter the queue immediately. The "first review tomorrow" toast on
  Add is intentional UX framing, not a real schedule push.
- **Long absence.** User skips a week. We don't penalize. When they come back
  the queue is huge — show a calm "Your queue: N items. Start small." nudge.
- **Daily input cap reached.** Adding new memories is throttled at 20/day
  (configurable in Settings). The error state on the Add screen is a soft
  warning, not a block — they can override.
- **A folder with zero due items.** Knowledge shows the folder with retention
  bar full + no count badge. Tap still opens the folder list.
- **Time-zone drift.** Store `next_review_at` as `timestamptz`, compare to
  the user's local "tomorrow at morning_review_at". Edge function in Phase 4.

## Where it lives in code (planned)

```
features/srs/
├── scheduler.ts        Pure function: update(memory, response) → memory'
├── scheduler.test.ts   Vitest unit tests covering each update branch
├── queue.ts            Pulls the due queue, slices by layer, applies cap
└── types.ts            Memory + review types
```

Pure function intent: the scheduler is the most testable piece of the app.
Keep it without React, without Supabase, without async — just inputs and
outputs. The store calls into it and persists.
