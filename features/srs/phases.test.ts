import { describe, expect, it } from "vitest";
import {
  PHASE_SPEC,
  REVIEW_PHASES,
  firstReview,
  layerForPhase,
  scheduleFor,
} from "./phases";

const T0 = new Date("2026-09-02T10:00:00.000Z");
const H = 60 * 60 * 1000;
const D = 24 * H;

describe("firstReview", () => {
  it("mette il primo ripasso a T0 + 20 ore, non subito", () => {
    const s = firstReview(T0);
    expect(s.phase).toBe("p20h");
    expect(s.nextReviewAt).toBe(new Date(T0.getTime() + 20 * H).toISOString());
  });

  it("mette la scadenza a T0 + 48 ore", () => {
    expect(firstReview(T0).reviewWindowEnd).toBe(
      new Date(T0.getTime() + 48 * H).toISOString(),
    );
  });

  it("non nasce in recupero e non ha ripassi alle spalle", () => {
    const s = firstReview(T0);
    expect(s.recoveryFrom).toBeNull();
    expect(s.lastReviewedAt).toBeNull();
  });
});

describe("scheduleFor", () => {
  it.each([
    ["p20h", 20 * H, 48 * H],
    ["p48h", 48 * H, 72 * H],
    ["p7d", 7 * D, 8 * D],
    ["p30d", 30 * D, 32 * D],
    ["p3m", 90 * D, 94 * D],
    ["p6m", 180 * D, 186 * D],
    ["p1y", 365 * D, 385 * D],
  ] as const)("%s apre a +%i ms e scade a +%i ms", (phase, start, end) => {
    const s = scheduleFor(phase, T0);
    expect(s.nextReviewAt).toBe(new Date(T0.getTime() + start).toISOString());
    expect(s.reviewWindowEnd).toBe(new Date(T0.getTime() + end).toISOString());
  });

  it.each([
    ["r24h", 24 * H],
    ["r48h", 48 * H],
    ["r3d", 3 * D],
    ["r7d", 7 * D],
    ["r14d", 14 * D],
    ["r30d", 30 * D],
    ["r2m", 60 * D],
  ] as const)("la fase di recupero %s apre a +%i ms", (phase, start) => {
    expect(scheduleFor(phase, T0).nextReviewAt).toBe(
      new Date(T0.getTime() + start).toISOString(),
    );
  });

  it("done non torna mai in coda e non scade", () => {
    const s = scheduleFor("done", T0);
    expect(Date.parse(s.nextReviewAt)).toBeGreaterThan(T0.getTime() + 100 * 365 * D);
    expect(s.reviewWindowEnd).toBeNull();
  });
});

describe("layerForPhase", () => {
  it("manda i due consolidamenti a Focus", () => {
    expect(layerForPhase("p20h")).toBe("focus");
    expect(layerForPhase("p48h")).toBe("focus");
  });

  it("manda 7 giorni e 30 giorni a Reinforcement", () => {
    expect(layerForPhase("p7d")).toBe("reinforcement");
    expect(layerForPhase("p30d")).toBe("reinforcement");
  });

  it("manda da 3 mesi in poi a Scan", () => {
    expect(layerForPhase("p3m")).toBe("scan");
    expect(layerForPhase("p6m")).toBe("scan");
    expect(layerForPhase("p1y")).toBe("scan");
    expect(layerForPhase("done")).toBe("scan");
  });

  it("tiene i recuperi brevi in Focus e quelli lunghi più in là", () => {
    expect(layerForPhase("r24h")).toBe("focus");
    expect(layerForPhase("r48h")).toBe("focus");
    expect(layerForPhase("r3d")).toBe("reinforcement");
    expect(layerForPhase("r7d")).toBe("reinforcement");
    expect(layerForPhase("r14d")).toBe("reinforcement");
    expect(layerForPhase("r30d")).toBe("scan");
    expect(layerForPhase("r2m")).toBe("scan");
  });

  it("copre ogni fase dichiarata — nessun buco nella tabella", () => {
    for (const p of REVIEW_PHASES) {
      expect(["scan", "reinforcement", "focus"]).toContain(layerForPhase(p));
      expect(PHASE_SPEC[p]).toBeDefined();
    }
  });
});
