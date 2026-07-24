/**
 * Logica pura della coda di ripasso: ripartizione del budget tempo sui tre
 * livelli e mapping Memory → ReviewCard. Nessun I/O — testato con vitest
 * (lib/queue.test.ts).
 */
import type { LayerKey } from "@/theme/tokens";
import type { Memory } from "./mappers";
import type { ReviewCard } from "./review-store";
import type { FolderKind } from "./constants";

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
  };
}
