import { describe, expect, it } from "vitest";
import {
  PHASE_SPEC,
  RECOVERY_ENTRY,
  REVIEW_PHASES,
  applyReview,
  firstReview,
  isOverdue,
  layerForPhase,
  scheduleFor,
  type PhaseState,
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

const at = (iso: string) => new Date(iso);
const state = (over: Partial<PhaseState> = {}): PhaseState => ({
  phase: "p20h",
  nextReviewAt: "2026-09-03T06:00:00.000Z",
  reviewWindowEnd: "2026-09-04T10:00:00.000Z",
  recoveryFrom: null,
  lastReviewedAt: null,
  ...over,
});

describe("isOverdue", () => {
  it("è in ritardo solo dopo la fine della finestra", () => {
    expect(isOverdue(state(), at("2026-09-04T09:59:00.000Z"))).toBe(false);
    expect(isOverdue(state(), at("2026-09-04T10:01:00.000Z"))).toBe(true);
  });

  it("una fase senza scadenza non è mai in ritardo", () => {
    expect(isOverdue(state({ reviewWindowEnd: null }), at("2999-01-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("applyReview — ricordato in orario", () => {
  it("avanza alla fase successiva e riancora ad adesso", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const next = applyReview(state(), "remembered", now);
    expect(next.phase).toBe("p48h");
    expect(next.lastReviewedAt).toBe(now.toISOString());
    expect(next.lifecycle).toBe("active");
    expect(next.recoveryFrom).toBeNull();
  });

  it("percorre tutta la scala fino a done", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const chain: string[] = [];
    let s = state();
    for (let i = 0; i < 8; i++) {
      s = applyReview(s, "remembered", now);
      chain.push(s.phase);
    }
    expect(chain).toEqual(["p48h", "p7d", "p30d", "p3m", "p6m", "p1y", "done", "done"]);
  });
});

describe("applyReview — ricordato ma in ritardo (fading)", () => {
  it("ripete la STESSA fase una volta invece di avanzare", () => {
    const late = at("2026-09-10T08:00:00.000Z"); // oltre la finestra
    const next = applyReview(state(), "remembered", late);
    expect(next.phase).toBe("p20h");
    expect(next.lifecycle).toBe("fading");
  });

  it("riapre la finestra da adesso, così il ripasso dopo avanza", () => {
    const late = at("2026-09-10T08:00:00.000Z");
    const repeated = applyReview(state(), "remembered", late);
    expect(repeated.nextReviewAt).toBe(new Date(late.getTime() + 20 * H).toISOString());
    const onTime = at("2026-09-11T06:00:00.000Z");
    expect(applyReview(repeated, "remembered", onTime).phase).toBe("p48h");
  });
});

describe("applyReview — dimenticato", () => {
  it("va sempre in recupero a +24h, da qualunque fase", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    for (const phase of ["p20h", "p48h", "p7d", "p30d", "p3m", "p6m", "p1y"] as const) {
      const next = applyReview(state({ phase }), "forgot", now);
      expect(next.phase).toBe("r24h");
      expect(next.nextReviewAt).toBe(new Date(now.getTime() + 24 * H).toISOString());
      expect(next.recoveryFrom).toBe(phase);
    }
  });

  it("dopo il recupero riuscito rientra dove dice la tabella di Maurizio", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const expected = {
      p20h: "r48h",
      p48h: "r3d",
      p7d: "r3d",
      p30d: "r7d",
      p3m: "r14d",
      p6m: "r30d",
      p1y: "r2m",
    } as const;
    for (const [from, entry] of Object.entries(expected)) {
      const recovering = state({ phase: "r24h", recoveryFrom: from as never, reviewWindowEnd: null });
      expect(applyReview(recovering, "remembered", now).phase).toBe(entry);
    }
  });

  it("i percorsi di recupero rientrano nella scala canonica", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const rejoin = { r48h: "p7d", r3d: "p7d", r7d: "p30d", r14d: "p30d", r30d: "p3m", r2m: "p3m" } as const;
    for (const [phase, after] of Object.entries(rejoin)) {
      const s = state({ phase: phase as never, recoveryFrom: "p7d", reviewWindowEnd: null });
      expect(applyReview(s, "remembered", now).phase).toBe(after);
    }
  });

  it("rientrato nella scala canonica, non è più in recupero", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const s = state({ phase: "r3d", recoveryFrom: "p7d", reviewWindowEnd: null });
    expect(applyReview(s, "remembered", now).recoveryFrom).toBeNull();
  });

  it("dimenticare DURANTE un recupero non rende il recupero più aggressivo", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const s = state({ phase: "r3d", recoveryFrom: "p1y", reviewWindowEnd: null });
    const next = applyReview(s, "forgot", now);
    expect(next.phase).toBe("r24h");
    expect(next.recoveryFrom).toBe("p1y"); // NON "r3d"
  });

  it("una carta a done che viene dimenticata rientra comunque nel recupero", () => {
    const now = at("2026-09-03T08:00:00.000Z");
    const next = applyReview(state({ phase: "done", reviewWindowEnd: null }), "forgot", now);
    expect(next.phase).toBe("r24h");
    expect(next.recoveryFrom).toBe("done");
    expect(RECOVERY_ENTRY.done).toBe("r2m");
  });
});
