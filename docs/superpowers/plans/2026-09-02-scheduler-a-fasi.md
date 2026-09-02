# Scheduler a fasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il motore SM-2 con la scala fissa di Maurizio — primo ripasso a T0+20h, poi 48h/7g/30g/3m/6m/1a con finestre di scadenza, Fading al superamento della finestra, e percorsi di recupero dopo un "dimenticato".

**Architecture:** Un modulo puro `features/srs/phases.ts` contiene tutta la logica (tabella delle fasi, avanzamento, recupero); non conosce React né Supabase ed è coperto da vitest. Il DB guadagna quattro colonne su `memories` e un backfill deterministico. Le letture non usano più `srs_repetitions` per il layer ma `review_phase`, e "in ritardo" diventa il confronto diretto `review_window_end < now()` — niente viste, niente job schedulati, niente `pg_cron`.

**Tech Stack:** TypeScript, Expo/React Native, Supabase (PostgREST + migrazioni SQL), zustand, vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md` (§F2). Fonti primarie del modello: `materiale_maurizio/feedback_2026-08-28/00..05_*.jpeg` e `materiale_maurizio/Memora Timing System UPDATED.pdf` §6/§15.

## Global Constraints

- **Node/test:** `npm test` = `vitest run`. Il config raccoglie SOLO `features/**/*.test.ts` e `lib/**/*.test.ts` (`vitest.config.ts`). Niente test su `app/` o `components/`.
- **Typecheck:** `npm run lint` = `tsc --noEmit`. Deve passare a ogni commit.
- **i18n:** `TKey = keyof typeof it` — una chiave aggiunta al solo `it.ts` è un errore di compilazione. `lib/i18n/i18n.test.ts` impone insiemi di chiavi identici, `{placeholder}` identici, coppie `_one`/`_other` e nessuna stringa vuota su **it/en/fr/es**.
- **Demo mode:** ogni funzione di `lib/api.ts` che tocca la rete inizia con `if (isDemoMode) return …`. Mantenerlo.
- **Purezza:** `features/srs/*` non importa mai React, Supabase o `lib/api`. Solo tipi.
- **Lingua:** commenti e copy in italiano, come il resto del repo. I nomi di simboli restano in inglese.
- **Le risposte sono binarie** dal 2026-08-29: `remembered` / `forgot`. `struggled` resta nel vocabolario dei tipi ma nessuna schermata lo produce.
- **NON implementare l'archiviazione automatica in questo piano.** Il superamento della finestra produce `fading`, mai `archived`. L'archiviazione entra solo insieme alla lista "Archiviati" con recupero a un tocco (piano separato), perché senza via di ritorno sarebbe perdita di dati silenziosa.

---

## Il modello, in una tabella

Scala canonica (screenshot 00/01, PDF §6):

| Fase | Disponibile | Scadenza | Ancoraggio | Layer | Grazia prima dell'archivio |
|---|---|---|---|---|---|
| `p20h` | +20h | +48h | creazione | focus | 0 |
| `p48h` | +48h | +72h | creazione | focus | 7g |
| `p7d` | +7g | +8g | ultimo ripasso riuscito | reinforcement | 7g |
| `p30d` | +30g | +32g | ultimo ripasso riuscito | reinforcement | 14g |
| `p3m` | +90g | +94g | ultimo ripasso riuscito | scan | 30g |
| `p6m` | +180g | +186g | ultimo ripasso riuscito | scan | 60g |
| `p1y` | +365g | +385g | ultimo ripasso riuscito | scan | 90g |
| `done` | mai | — | — | scan | — |

Percorsi di recupero (screenshot 03, letto direttamente dall'immagine). Il primo recupero è **sempre a +24h** da qualunque fase; la colonna dice dove si rientra dopo quel recupero riuscito, e più il ricordo era stabile più il rientro è dolce:

| Dimenticato in | Recupero | Poi rientra a | e da lì |
|---|---|---|---|
| `p20h` | +24h | `r48h` | → `p7d` → scala normale |
| `p48h` | +24h | `r3d` | → `p7d` → scala normale |
| `p7d` | +24h | `r3d` | → `p7d` → scala normale |
| `p30d` | +24h | `r7d` | → `p30d` → scala normale |
| `p3m` | +24h | `r14d` | → `p30d` → scala normale |
| `p6m` | +24h | `r30d` | → `p3m` → scala normale |
| `p1y` | +24h | `r2m` | → `p3m` → scala normale |

Due regole che cadono fuori da qui e vanno rispettate:

- **Fading + ricordato = ripete la stessa fase una volta** (screenshot 05). Non serve un flag: se una carta scaduta viene ricordata resta nella sua fase con una finestra nuova da adesso; il ripasso successivo, arrivando in orario, avanza normalmente. "Una volta" cade fuori da solo.
- **Dimenticare durante un recupero non peggiora il recupero**: `recovery_from` resta quello di partenza. "Dimenticato ≠ ricominciare tutto da zero" vale anche dentro il recupero.

---

## File Structure

| File | Responsabilità |
|---|---|
| `features/srs/phases.ts` **(nuovo)** | Tabella delle fasi, finestre, layer per fase, avanzamento, recupero. Puro. |
| `features/srs/phases.test.ts` **(nuovo)** | Copertura della scala e dei sette percorsi di recupero. |
| `features/srs/types.ts` | Aggiunge `ReviewPhase`, `PhaseState`; `initialSrsState` resta per le righe legacy finché il Task 8 non la ritira. |
| `features/srs/scheduler.ts` | SM-2. Ritirato nel Task 8. |
| `supabase/migrations/20260902100000_review_phases.sql` **(nuovo)** | Colonne, indici, backfill. |
| `lib/mappers.ts` | `MemoryRow`/`Memory` portano le nuove colonne. |
| `lib/api.ts` | `createMemory` semina T0+20h; le query di coda filtrano per fase e per finestra. |
| `lib/queue.ts` | `layerFor` passa dalle ripetizioni alla fase. |
| `lib/constants.ts` | Ritira `LAYER_REPS_*`. |
| `lib/review-store.ts` | Chiama il motore a fasi invece di SM-2. |
| `lib/i18n/{it,en,fr,es}.ts` | La copy dice la verità sulle 20 ore. |

---

### Task 1: La scala — dati, finestre, layer

**Files:**
- Create: `features/srs/phases.ts`
- Create: `features/srs/phases.test.ts`
- Modify: `features/srs/types.ts` (aggiunge i tipi, non tocca il resto)

**Interfaces:**
- Consumes: `LayerKey` da `@/theme/tokens` (valori `"scan" | "reinforcement" | "focus"`).
- Produces:
  - `type ReviewPhase` — union delle 15 fasi
  - `type PhaseState = { phase: ReviewPhase; nextReviewAt: string; reviewWindowEnd: string | null; recoveryFrom: ReviewPhase | null; lastReviewedAt: string | null }`
  - `PHASE_SPEC: Record<ReviewPhase, PhaseSpec>`
  - `layerForPhase(phase: ReviewPhase): LayerKey`
  - `scheduleFor(phase: ReviewPhase, anchor: Date): { nextReviewAt: string; reviewWindowEnd: string | null }`
  - `firstReview(createdAt: Date): PhaseState`

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `features/srs/phases.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- features/srs/phases.test.ts`
Expected: FAIL — `Failed to resolve import "./phases"`.

- [ ] **Step 3: Scrivere `features/srs/phases.ts`**

```ts
/**
 * La scala di ripasso di Memika — modello a FASI FISSE, non SM-2.
 *
 * Fonte: materiale_maurizio/feedback_2026-08-28 (screenshot 00-05) e
 * Memora Timing System UPDATED.pdf §6/§15. Dove le due divergono valgono
 * gli screenshot, che sono posteriori.
 *
 * Funzione pura: stessi ingressi, stessa uscita. Niente React, niente
 * Supabase, niente I/O. Chi persiste è lib/api.ts.
 *
 * Perché a fasi e non SM-2: la scala ha intervalli SOTTO il giorno (20h) e
 * scadenze per fase, due cose che il vecchio motore non poteva esprimere —
 * lavorava a giorni interi per scelta dichiarata.
 */

import type { LayerKey } from "@/theme/tokens";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Sentinella per "non torna più in coda". Non usiamo null: next_review_at è NOT NULL a DB. */
const NEVER = new Date("2999-12-31T00:00:00.000Z");

export const REVIEW_PHASES = [
  "p20h",
  "p48h",
  "p7d",
  "p30d",
  "p3m",
  "p6m",
  "p1y",
  "done",
  "r24h",
  "r48h",
  "r3d",
  "r7d",
  "r14d",
  "r30d",
  "r2m",
] as const;

export type ReviewPhase = (typeof REVIEW_PHASES)[number];

export type PhaseSpec = {
  /** Da quanto tempo dall'ancoraggio la carta torna disponibile. */
  startMs: number;
  /** Entro quando andrebbe fatta. null = non scade mai. */
  endMs: number | null;
  /** Quanto si resta in Fading prima dell'archivio (usato dal piano archivio, non qui). */
  graceMs: number;
  layer: LayerKey;
  /** Fase successiva dopo un ripasso riuscito e IN ORARIO. */
  next: ReviewPhase;
};

/**
 * Le fasi di recupero (r*) rientrano nella scala canonica in un punto che
 * dipende da quanto era stabile il ricordo: chi dimentica a 20 ore riparte
 * da 48 ore, chi dimentica a un anno riparte da due mesi. "Più il ricordo
 * era vecchio e stabile, meno aggressivo deve essere il recupero."
 */
export const PHASE_SPEC: Record<ReviewPhase, PhaseSpec> = {
  p20h: { startMs: 20 * HOUR_MS, endMs: 48 * HOUR_MS, graceMs: 0, layer: "focus", next: "p48h" },
  p48h: { startMs: 48 * HOUR_MS, endMs: 72 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "p7d" },
  p7d: { startMs: 7 * DAY_MS, endMs: 8 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p30d" },
  p30d: { startMs: 30 * DAY_MS, endMs: 32 * DAY_MS, graceMs: 14 * DAY_MS, layer: "reinforcement", next: "p3m" },
  p3m: { startMs: 90 * DAY_MS, endMs: 94 * DAY_MS, graceMs: 30 * DAY_MS, layer: "scan", next: "p6m" },
  p6m: { startMs: 180 * DAY_MS, endMs: 186 * DAY_MS, graceMs: 60 * DAY_MS, layer: "scan", next: "p1y" },
  p1y: { startMs: 365 * DAY_MS, endMs: 385 * DAY_MS, graceMs: 90 * DAY_MS, layer: "scan", next: "done" },
  done: { startMs: 0, endMs: null, graceMs: 0, layer: "scan", next: "done" },

  r24h: { startMs: 24 * HOUR_MS, endMs: 48 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "r48h" },
  r48h: { startMs: 48 * HOUR_MS, endMs: 72 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "p7d" },
  r3d: { startMs: 3 * DAY_MS, endMs: 4 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p7d" },
  r7d: { startMs: 7 * DAY_MS, endMs: 8 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p30d" },
  r14d: { startMs: 14 * DAY_MS, endMs: 16 * DAY_MS, graceMs: 14 * DAY_MS, layer: "reinforcement", next: "p30d" },
  r30d: { startMs: 30 * DAY_MS, endMs: 32 * DAY_MS, graceMs: 14 * DAY_MS, layer: "scan", next: "p3m" },
  r2m: { startMs: 60 * DAY_MS, endMs: 64 * DAY_MS, graceMs: 30 * DAY_MS, layer: "scan", next: "p3m" },
};

/** Stato di programmazione di un ricordo. Specchio esatto delle colonne DB. */
export type PhaseState = {
  phase: ReviewPhase;
  /** ISO. Inizio finestra: da qui la carta entra in coda. */
  nextReviewAt: string;
  /** ISO. Fine finestra: oltre questa la carta è in ritardo (fading). null = non scade. */
  reviewWindowEnd: string | null;
  /** Fase in cui è avvenuto il "dimenticato" che ha aperto il recupero. null = non in recupero. */
  recoveryFrom: ReviewPhase | null;
  /** ISO dell'ultimo ripasso, riuscito o no. null = mai ripassato. */
  lastReviewedAt: string | null;
};

export function layerForPhase(phase: ReviewPhase): LayerKey {
  return PHASE_SPEC[phase].layer;
}

/** Calcola inizio e fine finestra di una fase a partire dal suo ancoraggio. */
export function scheduleFor(
  phase: ReviewPhase,
  anchor: Date,
): { nextReviewAt: string; reviewWindowEnd: string | null } {
  const spec = PHASE_SPEC[phase];
  if (phase === "done") {
    return { nextReviewAt: NEVER.toISOString(), reviewWindowEnd: null };
  }
  return {
    nextReviewAt: new Date(anchor.getTime() + spec.startMs).toISOString(),
    reviewWindowEnd:
      spec.endMs === null ? null : new Date(anchor.getTime() + spec.endMs).toISOString(),
  };
}

/**
 * Stato di un ricordo appena creato. T0 = istante del salvataggio: TUTTO il
 * timing iniziale si conta da qui, non da quando l'utente apre l'app.
 */
export function firstReview(createdAt: Date = new Date()): PhaseState {
  return {
    phase: "p20h",
    ...scheduleFor("p20h", createdAt),
    recoveryFrom: null,
    lastReviewedAt: null,
  };
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- features/srs/phases.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Aggiungere i tipi condivisi a `types.ts`**

In `features/srs/types.ts`, subito sotto `export type MemoryLifecycleState = "active" | "fading" | "archived";` (riga 40), aggiungi:

```ts
/** Ri-export così i consumatori non devono dual-importare da phases.ts. */
export type { PhaseState, ReviewPhase } from "./phases";
```

- [ ] **Step 6: Typecheck**

Run: `npm run lint`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add features/srs/phases.ts features/srs/phases.test.ts features/srs/types.ts
git commit -m "feat(srs): scala a fasi di Maurizio — tabella, finestre e layer per fase"
```

---

### Task 2: Avanzamento e recupero

**Files:**
- Modify: `features/srs/phases.ts`
- Modify: `features/srs/phases.test.ts`

**Interfaces:**
- Consumes: `PhaseState`, `PHASE_SPEC`, `scheduleFor` dal Task 1.
- Produces:
  - `type ReviewOutcome = "remembered" | "forgot"`
  - `RECOVERY_ENTRY: Record<ReviewPhase, ReviewPhase>` — dove si rientra dopo il recupero a 24h
  - `applyReview(state: PhaseState, outcome: ReviewOutcome, now: Date): PhaseState & { lifecycle: "active" | "fading" }`
  - `isOverdue(state: PhaseState, now: Date): boolean`

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungi in fondo a `features/srs/phases.test.ts`:

```ts
import { RECOVERY_ENTRY, applyReview, isOverdue } from "./phases";

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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- features/srs/phases.test.ts`
Expected: FAIL — `RECOVERY_ENTRY`, `applyReview`, `isOverdue` non esportati.

- [ ] **Step 3: Implementare in `features/srs/phases.ts`**

Aggiungi in fondo al file:

```ts
export type ReviewOutcome = "remembered" | "forgot";

/**
 * Dove si rientra dopo il recupero a 24 ore, in base alla fase in cui si è
 * dimenticato (screenshot 03). Più stabile era il ricordo, più dolce il
 * rientro: chi dimentica a 20 ore riparte da 48 ore, chi dimentica a un
 * anno riparte da due mesi.
 *
 * Le fasi di recupero mappano su sé stesse: dimenticare durante un recupero
 * non lo rende più aggressivo — `recoveryFrom` resta quello di partenza e
 * questa tabella non viene nemmeno consultata.
 */
export const RECOVERY_ENTRY: Record<ReviewPhase, ReviewPhase> = {
  p20h: "r48h",
  p48h: "r3d",
  p7d: "r3d",
  p30d: "r7d",
  p3m: "r14d",
  p6m: "r30d",
  p1y: "r2m",
  done: "r2m",
  r24h: "r48h",
  r48h: "r48h",
  r3d: "r3d",
  r7d: "r7d",
  r14d: "r14d",
  r30d: "r30d",
  r2m: "r2m",
};

const RECOVERY_PHASES: ReadonlySet<ReviewPhase> = new Set([
  "r24h",
  "r48h",
  "r3d",
  "r7d",
  "r14d",
  "r30d",
  "r2m",
]);

/** La finestra è scaduta senza che il ripasso sia stato fatto. */
export function isOverdue(state: PhaseState, now: Date = new Date()): boolean {
  if (!state.reviewWindowEnd) return false;
  return now.getTime() > Date.parse(state.reviewWindowEnd);
}

/**
 * Applica una risposta e restituisce il nuovo stato.
 *
 * Tre rami:
 *  - dimenticato    → recupero a +24h, ricordando da dove si viene
 *  - ricordato in ritardo → RIPETE la stessa fase una volta (screenshot 05);
 *    non serve un contatore, perché la finestra riparte da adesso e il
 *    ripasso successivo, se puntuale, avanza da solo
 *  - ricordato in orario  → avanza di una fase
 *
 * `lifecycle` descrive com'era la carta QUANDO l'utente l'ha vista, non come
 * sarà dopo: dopo un ripasso la scadenza è sempre nel futuro, quindi lo
 * stato "fresco" non direbbe nulla di utile.
 */
export function applyReview(
  state: PhaseState,
  outcome: ReviewOutcome,
  now: Date = new Date(),
): PhaseState & { lifecycle: "active" | "fading" } {
  const lifecycle = isOverdue(state, now) ? ("fading" as const) : ("active" as const);
  const lastReviewedAt = now.toISOString();

  if (outcome === "forgot") {
    // Se era già in recupero, la sorgente NON cambia: dimenticare durante un
    // recupero non deve renderlo più duro.
    const recoveryFrom = state.recoveryFrom ?? state.phase;
    return {
      phase: "r24h",
      ...scheduleFor("r24h", now),
      recoveryFrom,
      lastReviewedAt,
      lifecycle,
    };
  }

  // Ricordato, ma la finestra era scaduta: si ripete la stessa fase.
  if (lifecycle === "fading") {
    return {
      phase: state.phase,
      ...scheduleFor(state.phase, now),
      recoveryFrom: state.recoveryFrom,
      lastReviewedAt,
      lifecycle,
    };
  }

  // Ricordato in orario. Dal recupero a 24 ore si rientra dove dice la
  // tabella; dalle altre fasi di recupero si rientra nella scala canonica.
  const nextPhase: ReviewPhase =
    state.phase === "r24h"
      ? RECOVERY_ENTRY[state.recoveryFrom ?? "p20h"]
      : PHASE_SPEC[state.phase].next;

  return {
    phase: nextPhase,
    ...scheduleFor(nextPhase, now),
    recoveryFrom: RECOVERY_PHASES.has(nextPhase) ? state.recoveryFrom : null,
    lastReviewedAt,
    lifecycle,
  };
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- features/srs/phases.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run lint
git add features/srs/phases.ts features/srs/phases.test.ts
git commit -m "feat(srs): avanzamento, ripetizione in fading e percorsi di recupero"
```

---

### Task 3: Migrazione DB — colonne, indici, backfill

**Files:**
- Create: `supabase/migrations/20260902100000_review_phases.sql`

**Interfaces:**
- Produces: su `public.memories` le colonne `review_phase text NOT NULL DEFAULT 'p20h'`, `review_window_end timestamptz`, `recovery_from text`, `last_result text`; indice `memories_user_phase_idx`.

- [ ] **Step 1: Scrivere la migrazione**

Crea `supabase/migrations/20260902100000_review_phases.sql`:

```sql
-- Scala a fasi di Maurizio (screenshot 2026-08-28) al posto di SM-2.
--
-- Perché: il primo ripasso deve cadere a T0+20h e ogni fase ha una scadenza.
-- Il vecchio motore lavorava a GIORNI INTERI per scelta dichiarata
-- (features/srs/scheduler.ts) e la colonna srs_interval_days è un int: 20 ore
-- non erano rappresentabili.
--
-- "In ritardo" NON diventa una colonna di stato né un job schedulato: è il
-- confronto review_window_end < now(), che il client fa come un normale
-- filtro. Sempre corretto per costruzione, niente da monitorare.
--
-- NOTA: questa migrazione NON archivia nulla. Il superamento della finestra
-- produce solo "in ritardo". L'archiviazione automatica arriva insieme alla
-- lista Archiviati con recupero a un tocco: senza via di ritorno sarebbe
-- perdita di dati silenziosa.

alter table public.memories
  add column review_phase text not null default 'p20h'
    check (review_phase in (
      'p20h','p48h','p7d','p30d','p3m','p6m','p1y','done',
      'r24h','r48h','r3d','r7d','r14d','r30d','r2m'
    )),
  add column review_window_end timestamptz,
  add column recovery_from text
    check (recovery_from is null or recovery_from in (
      'p20h','p48h','p7d','p30d','p3m','p6m','p1y','done'
    )),
  add column last_result text
    check (last_result is null or last_result in ('remembered','struggled','forgot'));

comment on column public.memories.review_phase is
  'Fase della scala di Maurizio. p* = scala canonica, r* = percorso di recupero dopo un "dimenticato". Decide il layer di ripasso (features/srs/phases.ts layerForPhase).';
comment on column public.memories.review_window_end is
  'Fine della finestra di ripasso. now() oltre questo valore = ricordo in ritardo. null = la fase non scade.';
comment on column public.memories.recovery_from is
  'Fase in cui e'' avvenuto il "dimenticato" che ha aperto il recupero; decide dove si rientra. null = non in recupero.';

-- Backfill deterministico dalle ripetizioni SM-2 esistenti.
-- I due consolidamenti si ancorano alla CREAZIONE (come da spec: tutto il
-- timing iniziale parte da T0); da 7 giorni in poi all'ultimo ripasso, con
-- created_at come rete di sicurezza se last_reviewed_at fosse null.
update public.memories set
  review_phase = case
    when srs_repetitions <= 0 then 'p20h'
    when srs_repetitions = 1 then 'p48h'
    when srs_repetitions = 2 then 'p7d'
    when srs_repetitions = 3 then 'p30d'
    else 'p3m'
  end,
  next_review_at = case
    when srs_repetitions <= 0 then created_at + interval '20 hours'
    when srs_repetitions = 1 then created_at + interval '48 hours'
    when srs_repetitions = 2 then coalesce(last_reviewed_at, created_at) + interval '7 days'
    when srs_repetitions = 3 then coalesce(last_reviewed_at, created_at) + interval '30 days'
    else coalesce(last_reviewed_at, created_at) + interval '90 days'
  end,
  review_window_end = case
    when srs_repetitions <= 0 then created_at + interval '48 hours'
    when srs_repetitions = 1 then created_at + interval '72 hours'
    when srs_repetitions = 2 then coalesce(last_reviewed_at, created_at) + interval '8 days'
    when srs_repetitions = 3 then coalesce(last_reviewed_at, created_at) + interval '32 days'
    else coalesce(last_reviewed_at, created_at) + interval '94 days'
  end
where deleted_at is null;

-- I ricordi gia' nel cestino non vengono ritoccati: se qualcuno li recupera
-- devono tornare com'erano.

-- La coda si legge per utente + fase + scadenza.
create index memories_user_phase_idx
  on public.memories (user_id, review_phase, next_review_at)
  where deleted_at is null;

-- I ritardatari si leggono per finestra.
create index memories_user_window_idx
  on public.memories (user_id, review_window_end)
  where deleted_at is null and review_window_end is not null;
```

- [ ] **Step 2: Applicare la migrazione in locale e verificare il backfill**

Run:
```bash
npx supabase db push
```

Poi, nella SQL console di Supabase, verifica che nessuna riga viva sia rimasta senza finestra e che la distribuzione delle fasi abbia senso:

```sql
select review_phase, count(*), min(next_review_at), max(review_window_end)
from public.memories where deleted_at is null
group by review_phase order by 1;

select count(*) as senza_finestra
from public.memories where deleted_at is null and review_window_end is null;
```

Expected: `senza_finestra` = 0. Le fasi presenti riflettono le ripetizioni che c'erano.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260902100000_review_phases.sql
git commit -m "feat(db): colonne di fase, finestra e recupero su memories, con backfill"
```

---

### Task 4: Mappers e creazione — il ricordo nasce a T0+20h

**Files:**
- Modify: `lib/mappers.ts` (`MemoryRow` ~riga 178, `Memory` ~riga 203, `mapMemory` ~riga 230)
- Modify: `lib/api.ts:447-478` (`createMemory`)
- Create: `lib/mappers.phases.test.ts`

**Interfaces:**
- Consumes: `firstReview`, `ReviewPhase` da `@/features/srs/phases`.
- Produces: `Memory.phase: ReviewPhase`, `Memory.reviewWindowEnd: string | null`, `Memory.recoveryFrom: ReviewPhase | null`; `toPhaseState(m: Memory): PhaseState`.

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `lib/mappers.phases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapMemory, toPhaseState, type MemoryRow } from "./mappers";

const row = (over: Partial<MemoryRow> = {}): MemoryRow => ({
  id: "m1",
  user_id: "u1",
  folder_id: "f1",
  term: "embargo",
  reading: null,
  definition: "blocco commerciale",
  example: null,
  item_type: null,
  state: "active",
  srs_interval_days: 0,
  srs_ease_factor: 2.5,
  srs_repetitions: 0,
  last_reviewed_at: null,
  next_review_at: "2026-09-03T06:00:00.000Z",
  review_phase: "p20h",
  review_window_end: "2026-09-04T10:00:00.000Z",
  recovery_from: null,
  created_at: "2026-09-02T10:00:00.000Z",
  updated_at: "2026-09-02T10:00:00.000Z",
  ...over,
});

describe("mapMemory — campi di fase", () => {
  it("porta fase, finestra e recupero nel modello", () => {
    const m = mapMemory(row());
    expect(m.phase).toBe("p20h");
    expect(m.reviewWindowEnd).toBe("2026-09-04T10:00:00.000Z");
    expect(m.recoveryFrom).toBeNull();
  });

  it("una riga vecchia senza colonne di fase non esplode", () => {
    const m = mapMemory(row({ review_phase: undefined, review_window_end: undefined }));
    expect(m.phase).toBe("p20h");
    expect(m.reviewWindowEnd).toBeNull();
  });
});

describe("toPhaseState", () => {
  it("ricompone lo stato che il motore si aspetta", () => {
    expect(toPhaseState(mapMemory(row()))).toEqual({
      phase: "p20h",
      nextReviewAt: "2026-09-03T06:00:00.000Z",
      reviewWindowEnd: "2026-09-04T10:00:00.000Z",
      recoveryFrom: null,
      lastReviewedAt: null,
    });
  });
});
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

Run: `npm test -- lib/mappers.phases.test.ts`
Expected: FAIL — `toPhaseState` non esportata, `phase` non esiste su `Memory`.

- [ ] **Step 3: Estendere `lib/mappers.ts`**

In `MemoryRow`, sotto `next_review_at: string;`, aggiungi:

```ts
  /** Fase della scala (migration 20260902100000). Opzionale: le righe lette da un client vecchio non ce l'hanno. */
  review_phase?: ReviewPhase | null;
  review_window_end?: string | null;
  recovery_from?: ReviewPhase | null;
  last_result?: string | null;
```

In `Memory`, sotto `nextReviewAt: string;`, aggiungi:

```ts
  /** Fase della scala di Maurizio. Decide il layer di ripasso. */
  phase: ReviewPhase;
  /** Fine finestra; oltre questa il ricordo è in ritardo. null = non scade. */
  reviewWindowEnd: string | null;
  /** Fase da cui viene il recupero in corso; null = non in recupero. */
  recoveryFrom: ReviewPhase | null;
```

In cima al file aggiungi l'import:

```ts
import type { PhaseState, ReviewPhase } from "@/features/srs/phases";
```

In `mapMemory`, sotto `nextReviewAt: row.next_review_at,`, aggiungi:

```ts
    phase: row.review_phase ?? "p20h",
    reviewWindowEnd: row.review_window_end ?? null,
    recoveryFrom: row.recovery_from ?? null,
```

In fondo alla sezione Memory, aggiungi:

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- lib/mappers.phases.test.ts`
Expected: PASS.

- [ ] **Step 5: Far nascere il ricordo a T0+20h**

In `lib/api.ts`, sostituisci il commento e il corpo di `createMemory` (righe 441-478). Il commento vecchio dice *"next_review_at = now(): entra subito in coda — il toast «primo ripasso domani» è framing UX"*: va tolto, perché ora è falso.

```ts
/**
 * Crea un ricordo e lo programma sulla scala di Maurizio: il primo ripasso
 * cade a T0 + 20 ore, dove T0 è QUESTO istante. Prima entrava subito in coda
 * e il toast "primo ripasso domani" era una bugia gentile; ora la copy e il
 * calendario dicono la stessa cosa.
 *
 * Le colonne srs_* restano scritte finché esistono righe e binari che le
 * leggono; lo scheduler non le guarda più.
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
  const phase = firstReview();
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
      srs_interval_days: 0,
      srs_ease_factor: 2.5,
      srs_repetitions: 0,
      last_reviewed_at: null,
      next_review_at: phase.nextReviewAt,
      review_phase: phase.phase,
      review_window_end: phase.reviewWindowEnd,
      recovery_from: null,
    })
    .select("*")
    .single<MemoryRow>();
  if (error) throw error;
  return mapMemory(data);
}
```

Aggiorna l'import in cima a `lib/api.ts` (riga 52) da:

```ts
import { initialSrsState, type UpdatedSrs } from "@/features/srs/types";
```

a:

```ts
import { type UpdatedSrs } from "@/features/srs/types";
import { firstReview } from "@/features/srs/phases";
```

- [ ] **Step 6: Typecheck, test, commit**

```bash
npm run lint
npm test
git add lib/mappers.ts lib/mappers.phases.test.ts lib/api.ts
git commit -m "feat(srs): il ricordo nasce programmato a T0+20h, non piu' scaduto"
```

---

### Task 5: Letture — la coda si affetta per fase, non per ripetizioni

**Files:**
- Modify: `lib/queue.ts:62-68` (`layerFor`)
- Modify: `lib/queue.test.ts` (i test di `layerFor`, righe ~113-138)
- Modify: `lib/api.ts:799-884` (`fetchDueMemoriesByLayer`, `fetchDueCounts`)
- Modify: `lib/constants.ts:155-175` (ritira `LAYER_REPS_*`)

**Interfaces:**
- Consumes: `layerForPhase`, `ReviewPhase`, `PHASE_SPEC` dal Task 1; `Memory.phase` dal Task 4.
- Produces: `layerFor(phase: ReviewPhase, state: MemoryState): LayerKey | null`; `PHASES_BY_LAYER: Record<LayerKey, ReviewPhase[]>`.

- [ ] **Step 1: Aggiornare i test di `layerFor`**

In `lib/queue.test.ts`, sostituisci il blocco `describe` di `layerFor` con:

```ts
describe("layerFor", () => {
  it("manda i due consolidamenti a Focus", () => {
    expect(layerFor("p20h", "active")).toBe("focus");
    expect(layerFor("p48h", "active")).toBe("focus");
  });

  it("manda 7 e 30 giorni a Reinforcement", () => {
    expect(layerFor("p7d", "active")).toBe("reinforcement");
    expect(layerFor("p30d", "active")).toBe("reinforcement");
  });

  it("manda da 3 mesi in poi a Scan", () => {
    expect(layerFor("p3m", "active")).toBe("scan");
    expect(layerFor("p1y", "active")).toBe("scan");
  });

  it("una carta archiviata non sta in nessuna coda", () => {
    expect(layerFor("p20h", "archived")).toBeNull();
  });

  it("una carta in ritardo resta nel layer della SUA fase", () => {
    // Prima le carte fading finivano tutte in Reinforcement. Ora il layer
    // dipende dalla fase; il ritardo cambia solo l'ordine in coda.
    expect(layerFor("p3m", "fading")).toBe("scan");
  });
});
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

Run: `npm test -- lib/queue.test.ts`
Expected: FAIL — `layerFor` accetta ancora un numero.

- [ ] **Step 3: Riscrivere `layerFor` in `lib/queue.ts`**

Sostituisci le righe 62-68 con:

```ts
/**
 * Livello di ripasso di una memoria, dedotto dalla sua FASE.
 * `null` = archiviata, fuori da ogni coda.
 *
 * Prima il livello si deduceva dal numero di ripetizioni, che era un proxy
 * sbagliato: a ease standard 4 ripetizioni valgono ~37 giorni, quindi la
 * fase "30 giorni" — che la spec assegna a Reinforcement — finiva in Scan.
 * Il ritardo (fading) NON cambia più il livello: cambia solo la priorità in
 * coda, come dice lo screenshot 05.
 */
export function layerFor(phase: ReviewPhase, state: MemoryState): LayerKey | null {
  if (state === "archived") return null;
  return layerForPhase(phase);
}

/** Le fasi che alimentano ciascun livello — usato per i filtri PostgREST. */
export const PHASES_BY_LAYER: Record<LayerKey, ReviewPhase[]> = {
  focus: REVIEW_PHASES.filter((p) => PHASE_SPEC[p].layer === "focus"),
  reinforcement: REVIEW_PHASES.filter((p) => PHASE_SPEC[p].layer === "reinforcement"),
  scan: REVIEW_PHASES.filter((p) => PHASE_SPEC[p].layer === "scan"),
};
```

Aggiorna l'import in cima a `lib/queue.ts`:

```ts
import {
  PHASE_SPEC,
  REVIEW_PHASES,
  layerForPhase,
  type ReviewPhase,
} from "@/features/srs/phases";
import { type FolderKind, type MemoryState } from "./constants";
```

(togli `LAYER_REPS_FOCUS_BELOW` e `LAYER_REPS_REINFORCEMENT_BELOW` dall'import da `./constants`.)

- [ ] **Step 4: Ordinare le carte in ritardo per prime**

In `lib/queue.ts`, dentro `allocateByFolderPriority`, sostituisci il comparatore alla riga 94:

```ts
  const sorted = [...memories].sort((a, b) => rank(a) - rank(b) || due(a) - due(b));
```

con:

```ts
  // Le carte in ritardo hanno priorità sui ripassi normali (screenshot 05),
  // ma dentro la loro cartella: la priorità delle cartelle resta il primo
  // criterio, altrimenti un ritardo in una cartella secondaria scavalcherebbe
  // tutto il resto.
  const late = (m: Memory) =>
    m.reviewWindowEnd && Date.parse(m.reviewWindowEnd) < Date.now() ? 0 : 1;
  const sorted = [...memories].sort(
    (a, b) => rank(a) - rank(b) || late(a) - late(b) || due(a) - due(b),
  );
```

- [ ] **Step 5: Riscrivere i predicati in `lib/api.ts`**

In `fetchDueMemoriesByLayer` sostituisci il blocco dei predicati di livello (le righe con `srs_repetitions`) con:

```ts
  // Il livello ora si affetta per FASE. I predicati restano mutuamente
  // esclusivi — nel flusso Scan → Reinforcement → Focus nessuna carta
  // compare due volte — perché ogni fase appartiene a un solo livello.
  query = query.in("review_phase", PHASES_BY_LAYER[layer]);
```

In `fetchDueCounts` sostituisci le tre query dell'array con:

```ts
      base().in("review_phase", PHASES_BY_LAYER.scan),
      base().in("review_phase", PHASES_BY_LAYER.reinforcement),
      base().in("review_phase", PHASES_BY_LAYER.focus),
```

Aggiorna gli import di `lib/api.ts`: togli `LAYER_REPS_FOCUS_BELOW` e `LAYER_REPS_REINFORCEMENT_BELOW`, aggiungi `PHASES_BY_LAYER` all'import esistente da `./queue`.

- [ ] **Step 6: Aggiungere la lettura dei ritardatari**

In `lib/api.ts`, subito dopo `fetchDueCounts`, aggiungi:

```ts
/**
 * Quanti ricordi hanno superato la finestra della loro fase — la sezione
 * "Da recuperare" della Home. Nessuna colonna di stato e nessun job: il
 * ritardo è il confronto review_window_end < now(), calcolato alla lettura.
 */
export async function fetchOverdueCount(userId: string): Promise<number> {
  if (isDemoMode) return 0;
  const nowIso = new Date().toISOString();
  const paused = await pausedFolderIds(userId);
  let q = supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("state", "archived")
    .not("review_window_end", "is", null)
    .lt("review_window_end", nowIso);
  if (paused.length > 0) q = q.not("folder_id", "in", `(${paused.join(",")})`);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 7: Ritirare le costanti morte**

In `lib/constants.ts`, sostituisci il blocco di commento e le due costanti (righe ~157-175) con:

```ts
/**
 * Il livello di ripasso NON si deduce più dal numero di ripetizioni: si
 * deduce dalla fase (features/srs/phases.ts, layerForPhase). Le vecchie
 * soglie LAYER_REPS_* sono state rimosse il 2026-09-02 perché il conteggio
 * di ripetizioni era un proxy sbagliato — a ease standard 4 ripetizioni
 * valgono ~37 giorni, quindi la fase "30 giorni" finiva in Scan invece che
 * in Reinforcement.
 */
```

- [ ] **Step 8: Eseguire tutto, typecheck, commit**

```bash
npm test
npm run lint
git add lib/queue.ts lib/queue.test.ts lib/api.ts lib/constants.ts
git commit -m "feat(srs): coda affettata per fase, ritardatari per finestra"
```

---

### Task 6: Scrittura — il ripasso applica il motore a fasi

**Files:**
- Modify: `lib/api.ts:768-785` (`applyScheduledUpdate`)
- Modify: `lib/review-store.ts:687-720` (dove chiama lo scheduler) e `:210-219` (mapping risposta → esito)

**Interfaces:**
- Consumes: `applyReview`, `toPhaseState` dai Task 2 e 4.
- Produces: `applyPhaseUpdate(memoryId: string, next: PhaseState & { lifecycle }, result: ReviewOutcome): Promise<void>`.

- [ ] **Step 1: Sostituire la persistenza in `lib/api.ts`**

Sostituisci `applyScheduledUpdate` (righe 763-785) con:

```ts
/**
 * Persiste il risultato del motore a fasi. Le colonne srs_* non vengono più
 * toccate: restano al valore che avevano finché una migrazione successiva
 * non le rimuove. Demo: no-op.
 */
export async function applyPhaseUpdate(
  memoryId: string,
  next: PhaseState & { lifecycle: "active" | "fading" },
  result: ReviewOutcome,
): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("memories")
    .update({
      review_phase: next.phase,
      review_window_end: next.reviewWindowEnd,
      recovery_from: next.recoveryFrom,
      next_review_at: next.nextReviewAt,
      last_reviewed_at: next.lastReviewedAt,
      last_result: result,
      state: next.lifecycle,
    })
    .eq("id", memoryId);
  if (error) throw error;
}
```

Aggiorna gli import di `lib/api.ts`: aggiungi `type PhaseState, type ReviewOutcome` all'import da `@/features/srs/phases`.

- [ ] **Step 2: Collegare il review store**

In `lib/review-store.ts`, l'import dello scheduler:

```ts
import { update as scheduleUpdate } from "@/features/srs/scheduler";
```

diventa:

```ts
import { applyReview, type ReviewOutcome } from "@/features/srs/phases";
```

E il mapping risposta → esito (righe ~210-219) diventa binario:

```ts
/**
 * Le risposte dell'interfaccia sono binarie dal 2026-08-29 (Maurizio): o il
 * ricordo torna o non torna. "skipped" non è un fallimento — la carta resta
 * dov'è e non viene toccata, quindi non produce alcun esito.
 */
function toReviewOutcome(response: ReviewResponse): ReviewOutcome | null {
  if (response === "skipped") return null;
  return response === "remembered" ? "remembered" : "forgot";
}
```

Nel blocco che oggi chiama `scheduleUpdate` (righe ~687-720), sostituisci:

```ts
    const prior = state.srsByCard[card.id] ?? card.srs ?? initialSrsState();
    const updated = scheduleUpdate(prior, toLayerOutcome(state.layer, response));
```

con:

```ts
    const outcome = toReviewOutcome(response);
    if (!outcome) return; // "salta": la carta resta programmata com'è
    const prior = state.phaseByCard[card.id] ?? card.phase;
    const updated = applyReview(prior, outcome);
```

e la scrittura:

```ts
      void applyScheduledUpdate(card.id, finalSrs).catch(...)
```

con:

```ts
      void applyPhaseUpdate(card.id, updated, outcome).catch((e) =>
        reportError("review/apply-phase", e),
      );
```

- [ ] **Step 3: Portare la fase dentro `ReviewCard`**

In `lib/queue.ts`, `toReviewCard` deve trasportare lo stato di fase. Sostituisci il ritorno:

```ts
    srs: { ...m.srs, nextReviewAt: m.nextReviewAt, lastReviewedAt: m.lastReviewedAt },
```

con:

```ts
    srs: { ...m.srs, nextReviewAt: m.nextReviewAt, lastReviewedAt: m.lastReviewedAt },
    phase: toPhaseState(m),
```

e aggiungi `phase: PhaseState;` al tipo `ReviewCard` in `lib/review-store.ts`, accanto a `srs`. Importa `toPhaseState` da `./mappers` e `type PhaseState` da `@/features/srs/phases`.

Rinomina lo stato locale `srsByCard` in `phaseByCard` con tipo `Record<string, PhaseState>` (stessa meccanica, altro contenuto). L'"amend" dello Scan (`amendLastAnswer`, righe ~787-816) continua a funzionare: riapplica `applyReview` sullo stato precedente conservato.

- [ ] **Step 4: Eseguire tutto e verificare**

Run: `npm test && npm run lint`
Expected: PASS, nessun errore di tipo.

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts lib/review-store.ts lib/queue.ts lib/mappers.ts
git commit -m "feat(srs): il ripasso applica la scala a fasi e persiste fase, finestra e recupero"
```

---

### Task 7: La copy dice la verità

**Files:**
- Modify: `lib/i18n/it.ts:48,55,60` e le stesse righe in `en.ts`, `fr.ts`, `es.ts`
- Modify: `app/add.tsx:570` (la riga di anteprima)

**Interfaces:**
- Consumes: `firstReview` dal Task 1.
- Produces: la chiave `add.previewFirstReview` guadagna il segnaposto `{time}`.

- [ ] **Step 1: Cambiare le tre stringhe in tutti e quattro i cataloghi**

`lib/i18n/it.ts`:

```ts
  "add.previewFirstReview": "Primo ripasso · {time}",
  "add.savedToast": "Salvato in {name} · primo ripasso tra 20 ore",
  "add.useItTodayHint": "Prova a usarlo nella vita reale oggi — il primo ripasso è tra 20 ore.",
```

`lib/i18n/en.ts`:

```ts
  "add.previewFirstReview": "First review · {time}",
  "add.savedToast": "Saved to {name} · first review in 20 hours",
  "add.useItTodayHint": "Try using it in real life today — the first review is in 20 hours.",
```

`lib/i18n/es.ts`:

```ts
  "add.previewFirstReview": "Primer repaso · {time}",
  "add.savedToast": "Guardado en {name} · primer repaso en 20 horas",
  "add.useItTodayHint": "Intenta usarlo en la vida real hoy: el primer repaso es en 20 horas.",
```

`lib/i18n/fr.ts`:

```ts
  "add.previewFirstReview": "Première révision · {time}",
  "add.savedToast": "Enregistré dans {name} · première révision dans 20 heures",
  "add.useItTodayHint": "Essaie de l'utiliser dans la vraie vie aujourd'hui — la première révision est dans 20 heures.",
```

- [ ] **Step 2: Calcolare l'orario reale in `app/add.tsx`**

Alla riga 570, sostituisci `{t("add.previewFirstReview")}` con `{firstReviewLabel}` e aggiungi, sopra il `return` del componente:

```ts
  // L'anteprima mostrava un fisso "domani, 8:00" che non corrispondeva a
  // nulla: le 8:00 venivano da una colonna (profiles.morning_review_at) che
  // nessuno leggeva. Ora è l'orario vero del primo ripasso, T0 + 20 ore.
  const firstReviewLabel = t("add.previewFirstReview", {
    time: shortDateTime(firstReview().nextReviewAt),
  });
```

con `import { firstReview } from "@/features/srs/phases";` e `shortDateTime` da `lib/format.ts`.

`shortDateTime` non esiste: va aggiunta. Nota che `lib/format.ts` NON contiene stringhe — `DAY_SHORT` e `MONTH_SHORT` (righe 25 e 29) sono array di `TKey` risolti con `t()`. Segui quella convenzione. Aggiungi in `lib/format.ts`, accanto a `dateBadge`:

```ts
/** "MAR 3 SET, 06:00" — data breve + ora, per il primo ripasso. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return t("format.dateTimeShort", {
    day: t(DAY_SHORT[d.getDay()]),
    date: String(d.getDate()),
    month: t(MONTH_SHORT[d.getMonth()]),
    time: `${hh}:${mm}`,
  });
}
```

La chiave `format.dateTimeShort` è nuova e va in tutti e quattro i cataloghi, con gli **stessi quattro segnaposti** o `i18n.test.ts` fallisce:

```ts
// it.ts, subito dopo "format.dateBadge" (riga 576) — l'ordine è alfabetico
  "format.dateTimeShort": "{day} {date} {month}, {time}",
// en.ts
  "format.dateTimeShort": "{day} {date} {month}, {time}",
// es.ts
  "format.dateTimeShort": "{day} {date} {month}, {time}",
// fr.ts
  "format.dateTimeShort": "{day} {date} {month}, {time}",
```

E il test in `lib/format.test.ts`:

```ts
describe("shortDateTime", () => {
  it("compone giorno, data, mese e ora", () => {
    expect(shortDateTime("2026-09-03T06:05:00.000Z")).toMatch(/\d{2}:\d{2}$/);
  });

  it("non esplode su una data non valida", () => {
    expect(shortDateTime("non-una-data")).toBe("—");
  });
});
```

- [ ] **Step 3: Verificare la parità dei cataloghi**

Run: `npm test -- lib/i18n/i18n.test.ts`
Expected: PASS — insiemi di chiavi identici e `{time}` presente in tutte e quattro le lingue.

- [ ] **Step 4: Typecheck e commit**

```bash
npm run lint
git add lib/i18n/ app/add.tsx lib/format.ts lib/format.test.ts
git commit -m "fix(copy): il primo ripasso e' tra 20 ore, con l'orario vero al posto del finto 8:00"
```

---

### Task 8: Ritirare SM-2

**Files:**
- Delete: `features/srs/scheduler.ts`, `features/srs/scheduler.test.ts`
- Modify: `features/srs/types.ts` (toglie `initialSrsState`, `LayerOutcome`, `Quality`, `UpdatedSrs`)
- Modify: `docs/SRS.md`

**Interfaces:**
- Produces: nessuna. Rimozione di codice non più raggiungibile.

- [ ] **Step 1: Verificare che nulla li importi più**

Run:
```bash
grep -rn "srs/scheduler\|initialSrsState\|UpdatedSrs\|LayerOutcome\|qualityFor\|deriveLifecycleState" app/ lib/ components/ features/ --include=*.ts --include=*.tsx
```
Expected: nessun risultato fuori da `features/srs/scheduler.ts` e `features/srs/types.ts`. Se ne restano, sono call site dimenticati nei Task 4-6: sistemali prima di proseguire.

- [ ] **Step 2: Rimuovere**

```bash
git rm features/srs/scheduler.ts features/srs/scheduler.test.ts
```

In `features/srs/types.ts` togli `initialSrsState`, `LayerOutcome`, `Quality`, `UpdatedSrs`, `DEFAULT_EASE`, `MIN_EASE`, `FADING_OVERDUE_MULTIPLIER`. Restano `MemoryLifecycleState`, `SrsState` (le colonne legacy esistono ancora a DB) e i ri-export di fase.

- [ ] **Step 3: Aggiornare `docs/SRS.md`**

Riscrivi la sezione dell'algoritmo con la scala a fasi. In particolare vanno via le tre affermazioni ora false: che `next_review_at = now() + interval days`; che il layer si deduce da `srs_repetitions`; e la riga 137-139 che ammetteva *"The 'first review tomorrow' toast on Add is intentional UX framing, not a real schedule push"* — ora è una programmazione vera.

- [ ] **Step 4: Verificare che tutto regga**

```bash
npm test
npm run lint
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A features/srs docs/SRS.md
git commit -m "chore(srs): rimosso il motore SM-2, sostituito dalla scala a fasi"
```

---

## Verifica finale sul dispositivo

Automatizzare questo non ha senso: serve un telefono e la coda vera.

1. Salva un ricordo nuovo. L'anteprima deve dire l'orario di **fra 20 ore**, non "domani, 8:00".
2. Torna su Oggi: il ricordo **non** deve comparire nella coda. Prima compariva subito — questa è la modifica che Maurizio ha chiesto.
3. Nella scheda del ricordo, "Prossimo ripasso" deve mostrare la stessa data dell'anteprima. Prima si contraddicevano.
4. Su un ricordo già esistente e già scaduto, fai un ripasso e verifica in DB che `review_phase` sia avanzata di uno e che `review_window_end` sia coerente con la tabella.
5. Rispondi "dimenticato": `review_phase` deve diventare `r24h`, `recovery_from` la fase di partenza, `next_review_at` fra 24 ore.

**Da dire a Maurizio prima che aggiorni:** i ricordi aggiunti nelle ultime 20 ore escono dalla coda di oggi e ricompaiono a T0+20h. È il comportamento corretto, ma senza preavviso sembra che l'app abbia perso qualcosa.
