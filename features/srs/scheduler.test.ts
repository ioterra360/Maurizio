import { describe, expect, it } from "vitest";

import { DEFAULT_EASE, MIN_EASE, qualityFor, update } from "./scheduler";
import {
  initialSrsState,
  type LayerOutcome,
  type SrsState,
} from "./types";

const FIXED_NOW = new Date("2026-05-20T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function freshState(overrides: Partial<SrsState> = {}): SrsState {
  return { ...initialSrsState(FIXED_NOW), ...overrides };
}

describe("qualityFor", () => {
  it("maps scan outcomes", () => {
    expect(qualityFor({ layer: "scan", outcome: "remember" })).toBe(4);
    expect(qualityFor({ layer: "scan", outcome: "show" })).toBe(2);
  });

  it("maps reinforcement outcomes", () => {
    expect(qualityFor({ layer: "reinforcement", outcome: "continue" })).toBe(4);
    expect(qualityFor({ layer: "reinforcement", outcome: "again" })).toBe(1);
  });

  it("maps focus outcomes", () => {
    expect(qualityFor({ layer: "focus", outcome: "remembered" })).toBe(5);
    expect(qualityFor({ layer: "focus", outcome: "struggled" })).toBe(3);
    expect(qualityFor({ layer: "focus", outcome: "forgot" })).toBe(0);
  });
});

describe("update — forget branch (quality < 3)", () => {
  it("resets repetitions and interval on Focus forgot", () => {
    const state = freshState({ intervalDays: 30, repetitions: 7, easeFactor: 2.6 });
    const next = update(state, { layer: "focus", outcome: "forgot" }, FIXED_NOW);
    expect(next.quality).toBe(0);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    // Ease factor MUST NOT be touched on forget branch per SM-2.
    expect(next.easeFactor).toBe(2.6);
  });

  it("treats Scan 'show me' as a soft forget (quality 2)", () => {
    const state = freshState({ intervalDays: 14, repetitions: 5, easeFactor: 2.4 });
    const next = update(state, { layer: "scan", outcome: "show" }, FIXED_NOW);
    expect(next.quality).toBe(2);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBe(2.4);
  });

  it("treats Reinforcement 'review again' as a real failure (quality 1)", () => {
    const state = freshState({ intervalDays: 8, repetitions: 4 });
    const next = update(state, { layer: "reinforcement", outcome: "again" }, FIXED_NOW);
    expect(next.quality).toBe(1);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
  });

  it("sets nextReviewAt to tomorrow (now + 1 day) on forget", () => {
    const state = freshState({ intervalDays: 30, repetitions: 7 });
    const next = update(state, { layer: "focus", outcome: "forgot" }, FIXED_NOW);
    expect(new Date(next.nextReviewAt).getTime()).toBe(FIXED_NOW.getTime() + DAY_MS);
    expect(next.lastReviewedAt).toBe(FIXED_NOW.toISOString());
  });
});

describe("update — recall branch (quality >= 3)", () => {
  it("first recall yields interval 1 (repetitions: 0 -> 1)", () => {
    const state = freshState();
    const next = update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    // easeFactor on quality 5 should rise slightly above DEFAULT_EASE.
    expect(next.easeFactor).toBeGreaterThan(DEFAULT_EASE);
  });

  it("second recall yields interval 6 (repetitions: 1 -> 2)", () => {
    const state = freshState({ repetitions: 1, intervalDays: 1 });
    const next = update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it("third+ recall multiplies by easeFactor and rounds to whole days", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6, easeFactor: 2.5 });
    const next = update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(next.repetitions).toBe(3);
    // 6 * 2.5 = 15.
    expect(next.intervalDays).toBe(15);
  });

  it("ease floor MIN_EASE is enforced after many struggles (quality 3)", () => {
    // Quality 3 is the lower edge of the recall branch. Successive q=3
    // updates drive easeFactor down to MIN_EASE and never below.
    let state: SrsState = freshState({ repetitions: 1, intervalDays: 1, easeFactor: MIN_EASE + 0.5 });
    for (let i = 0; i < 20; i++) {
      const next = update(state, { layer: "focus", outcome: "struggled" }, FIXED_NOW);
      state = next;
    }
    expect(state.easeFactor).toBe(MIN_EASE);
  });

  it("Reinforcement 'continue' (quality 4) bumps interval like Focus 'remembered'", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6, easeFactor: 2.5 });
    const next = update(state, { layer: "reinforcement", outcome: "continue" }, FIXED_NOW);
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(15);
    expect(next.easeFactor).toBeCloseTo(2.5, 5);
  });

  it("Scan 'remember' (quality 4) advances the queue without overshoot", () => {
    const state = freshState({ repetitions: 3, intervalDays: 10, easeFactor: 2.3 });
    const next = update(state, { layer: "scan", outcome: "remember" }, FIXED_NOW);
    expect(next.repetitions).toBe(4);
    expect(next.intervalDays).toBe(Math.round(10 * 2.3)); // 23
  });

  it("nextReviewAt equals now + intervalDays for a recall", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6, easeFactor: 2.5 });
    const next = update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(new Date(next.nextReviewAt).getTime()).toBe(FIXED_NOW.getTime() + 15 * DAY_MS);
  });
});

describe("update — lifecycle state derivation", () => {
  it("a successful recall always returns active", () => {
    const state = freshState({ repetitions: 5, intervalDays: 20, nextReviewAt: new Date(FIXED_NOW.getTime() - 100 * DAY_MS).toISOString() });
    const next = update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(next.state).toBe("active");
  });

  it("a forget on a card that was only mildly overdue stays active", () => {
    const dueYesterday = new Date(FIXED_NOW.getTime() - DAY_MS).toISOString();
    const state = freshState({ repetitions: 4, intervalDays: 7, nextReviewAt: dueYesterday });
    const next = update(state, { layer: "focus", outcome: "forgot" }, FIXED_NOW);
    expect(next.state).toBe("active");
  });

  it("a forget on a card overdue beyond 1.5x interval flags fading", () => {
    // Interval was 4 days; due 10 days ago; overdue 10d > 4d * 1.5 = 6d.
    const dueLongAgo = new Date(FIXED_NOW.getTime() - 10 * DAY_MS).toISOString();
    const state = freshState({ repetitions: 3, intervalDays: 4, nextReviewAt: dueLongAgo });
    const next = update(state, { layer: "focus", outcome: "forgot" }, FIXED_NOW);
    expect(next.state).toBe("fading");
  });

  it("never returns archived — only the user can archive", () => {
    const state = freshState({ repetitions: 0, intervalDays: 0 });
    const outcomes: LayerOutcome[] = [
      { layer: "scan", outcome: "remember" },
      { layer: "scan", outcome: "show" },
      { layer: "reinforcement", outcome: "continue" },
      { layer: "reinforcement", outcome: "again" },
      { layer: "focus", outcome: "remembered" },
      { layer: "focus", outcome: "struggled" },
      { layer: "focus", outcome: "forgot" },
    ];
    for (const o of outcomes) {
      const next = update(state, o, FIXED_NOW);
      expect(next.state).not.toBe("archived");
    }
  });
});

describe("update — pure function guarantees", () => {
  it("does not mutate the input state", () => {
    const state = freshState({ intervalDays: 6, repetitions: 2, easeFactor: 2.5 });
    const snapshot = { ...state };
    update(state, { layer: "focus", outcome: "remembered" }, FIXED_NOW);
    expect(state).toEqual(snapshot);
  });

  it("same inputs produce identical outputs", () => {
    const state = freshState({ repetitions: 3, intervalDays: 15, easeFactor: 2.4 });
    const a = update(state, { layer: "focus", outcome: "struggled" }, FIXED_NOW);
    const b = update(state, { layer: "focus", outcome: "struggled" }, FIXED_NOW);
    expect(a).toEqual(b);
  });
});

describe("initialSrsState", () => {
  it("seeds DEFAULT_EASE, zero repetitions, and now-due", () => {
    const s = initialSrsState(FIXED_NOW);
    expect(s.easeFactor).toBe(DEFAULT_EASE);
    expect(s.repetitions).toBe(0);
    expect(s.intervalDays).toBe(0);
    expect(s.lastReviewedAt).toBeNull();
    expect(s.nextReviewAt).toBe(FIXED_NOW.toISOString());
  });
});
