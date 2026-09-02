/**
 * Logica pura della coda di ripasso: ripartizione del budget tempo sui tre
 * livelli e mapping Memory → ReviewCard. Nessun I/O — testato con vitest
 * (lib/queue.test.ts).
 */
import type { LayerKey } from "@/theme/tokens";
import { toPhaseState, type Memory } from "./mappers";
import type { ReviewCard } from "./review-store";
import {
  PHASE_SPEC,
  REVIEW_PHASES,
  layerForPhase,
  type ReviewPhase,
} from "@/features/srs/phases";
import { type FolderKind, type MemoryState } from "./constants";

export type LayerCounts = { scan: number; reinforcement: number; focus: number };

const LAYER_ORDER: readonly LayerKey[] = ["scan", "reinforcement", "focus"];

/** Dimensioni dei mazzi demo statici (review-store DECKS) per i conteggi offline. */
export const DEMO_DUE_COUNTS: LayerCounts = { scan: 4, reinforcement: 3, focus: 3 };

/** Secondi stimati per carta, per livello. Euristica dichiarata — da tarare. */
export const SECONDS_PER_ITEM: Record<LayerKey, number> = {
  scan: 20,
  reinforcement: 35,
  focus: 40,
};

/**
 * Ripartisce il tetto `capTotal` sui tre livelli in proporzione alla coda,
 * senza mai superare la coda del singolo livello. Il resto della divisione
 * va ai livelli con domanda residua in ordine Scan → Reinforcement → Focus.
 */
export function splitBudget(counts: LayerCounts, capTotal: number): LayerCounts {
  const total = counts.scan + counts.reinforcement + counts.focus;
  if (total <= capTotal) return { ...counts };
  const out: LayerCounts = { scan: 0, reinforcement: 0, focus: 0 };
  for (const l of LAYER_ORDER) {
    out[l] = Math.min(counts[l], Math.floor((capTotal * counts[l]) / total));
  }
  let rest = capTotal - (out.scan + out.reinforcement + out.focus);
  while (rest > 0) {
    let gave = false;
    for (const l of LAYER_ORDER) {
      if (rest > 0 && out[l] < counts[l]) {
        out[l] += 1;
        rest -= 1;
        gave = true;
      }
    }
    if (!gave) break; // ogni livello è saturo
  }
  return out;
}

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

/**
 * Compone il mazzo di un livello rispettando la priorità delle cartelle
 * (Cartelle: "le cartelle più in alto vengono proposte per prime"): prima
 * le carte della cartella #1 (scadenza più vicina prima), poi la #2, e così
 * via, fino al tetto `cap`. Cartelle senza priorità nota in coda.
 *
 * Pavimento: se il tetto può ospitare una carta per ogni cartella con carte
 * in coda, ogni cartella entra con la sua carta più urgente, e il resto si
 * riempie per priorità. Così un budget da 5 minuti tocca tutte le cartelle e
 * nessuna scivola verso il fading senza essere mai vista. Sotto quella
 * soglia vale la priorità pura. Il mazzo resta in ordine di priorità.
 * Puro; non muta l'input.
 */
export function allocateByFolderPriority(
  memories: readonly Memory[],
  priorityByFolderId: ReadonlyMap<string, number>,
  cap: number,
): Memory[] {
  const rank = (m: Memory) => priorityByFolderId.get(m.folderId) ?? Number.MAX_SAFE_INTEGER;
  const due = (m: Memory) => {
    const ms = Date.parse(m.nextReviewAt);
    return Number.isNaN(ms) ? 0 : ms;
  };
  const limit = Math.max(0, cap);
  // Le carte in ritardo hanno priorità sui ripassi normali (screenshot 05),
  // ma dentro la loro cartella: la priorità delle cartelle resta il primo
  // criterio, altrimenti un ritardo in una cartella secondaria scavalcherebbe
  // tutto il resto.
  const late = (m: Memory) =>
    m.reviewWindowEnd && Date.parse(m.reviewWindowEnd) < Date.now() ? 0 : 1;
  const sorted = [...memories].sort(
    (a, b) => rank(a) - rank(b) || late(a) - late(b) || due(a) - due(b),
  );
  if (sorted.length <= limit) return sorted;

  // Most urgent card of each folder (sorted is rank-then-due, so the first
  // hit per folder is its soonest due).
  const floor = new Map<string, Memory>();
  for (const m of sorted) if (!floor.has(m.folderId)) floor.set(m.folderId, m);
  if (floor.size > limit) return sorted.slice(0, limit);

  const chosen = new Set<Memory>(floor.values());
  for (const m of sorted) {
    if (chosen.size >= limit) break;
    chosen.add(m);
  }
  return sorted.filter((m) => chosen.has(m));
}

export function layerMinutes(layer: LayerKey, items: number): number {
  if (items <= 0) return 0;
  return Math.max(1, Math.ceil((items * SECONDS_PER_ITEM[layer]) / 60));
}

export function totalMinutes(counts: LayerCounts): number {
  return (
    layerMinutes("scan", counts.scan) +
    layerMinutes("reinforcement", counts.reinforcement) +
    layerMinutes("focus", counts.focus)
  );
}

/**
 * Memory (modello DB) → ReviewCard (modello dei tre screen di ripasso).
 * `hint` non esiste a DB: fallback = frase d'esempio, se c'è. Lo snapshot
 * SRS ricompone i campi che vivono FUORI da memory.srs (vedi la nota sul
 * tipo ReviewCard in review-store).
 */
export function toReviewCard(
  m: Memory,
  folderName: string,
  folderKind?: FolderKind,
): ReviewCard {
  return {
    id: m.id,
    front: m.term,
    reading: m.reading ?? undefined,
    back: m.definition,
    example: m.example ?? undefined,
    hint: m.example ?? undefined,
    folder: folderName,
    folderKind,
    srs: { ...m.srs, nextReviewAt: m.nextReviewAt, lastReviewedAt: m.lastReviewedAt },
    phase: toPhaseState(m),
  };
}
