/**
 * Riconciliazione fra il tetto di PIANO e il cursore GIORNALIERO
 * (decisione di Angelo del 7/9/2026: "10 in tutto").
 *
 * Sono due cose diverse e devono restare tali:
 *   - il tetto di piano (PLAN_LIMITS.free.memories = 10, cestino compreso)
 *     lo applica il trigger memories_enforce_plan_limit (P0004);
 *   - il cursore (profiles.daily_input_cap, DAILY_CAP_OPTIONS in
 *     Impostazioni) e' un avviso morbido lato client, mai bloccante e MAI
 *     un trigger: la colonna e' scrivibile dall'utente.
 *
 * Il modo in cui convivono senza un gate sul piano (docs/PAYMENTS.md
 * § I piani lo vieta: usePlan() degrada a free se il profilo non si carica)
 * e' l'invariante che questo file tiene: l'opzione MINIMA del cursore e'
 * >= al tetto free, quindi per un Free il cursore non morde mai
 * (dailyCount <= totalCount <= 10 <= min(DAILY_CAP_OPTIONS)) e Add puo'
 * mostrargli il contatore totale senza mai contraddire il giornaliero.
 */
import { describe, expect, it } from "vitest";

import { DAILY_CAP_OPTIONS, DAILY_INPUT_CAP_DEFAULT } from "./constants";
import { PLAN_LIMITS } from "./plan";

describe("DAILY_CAP_OPTIONS vs tetto del piano free", () => {
  it("l'opzione minima del cursore non scende sotto il tetto totale del Free", () => {
    // Se un giorno il minimo scendesse a 5, un Free con 7 ricordi vedrebbe
    // il contatore totale (7/10) mentre il cursore, non mostrato, sarebbe
    // gia' superato: due verita' in una schermata. Il vincolo va nell'altro
    // verso: si alza il minimo o si cambia PLAN_LIMITS, mai uno solo.
    const freeCap = PLAN_LIMITS.free.memories;
    expect(freeCap).not.toBeNull();
    expect(Math.min(...DAILY_CAP_OPTIONS)).toBeGreaterThanOrEqual(freeCap as number);
  });

  it("il valore di default del profilo e' una delle opzioni selezionabili", () => {
    // profiles.daily_input_cap nasce a DAILY_INPUT_CAP_DEFAULT: il selettore
    // deve poter evidenziare la scelta corrente senza un'opzione fantasma.
    expect(DAILY_CAP_OPTIONS).toContain(DAILY_INPUT_CAP_DEFAULT);
  });

  it("le opzioni sono crescenti e senza doppioni", () => {
    const sorted = [...DAILY_CAP_OPTIONS].sort((a, b) => a - b);
    expect([...DAILY_CAP_OPTIONS]).toEqual(sorted);
    expect(new Set(DAILY_CAP_OPTIONS).size).toBe(DAILY_CAP_OPTIONS.length);
  });

  it("ogni opzione sta nel check della colonna (1..200)", () => {
    // 20260519220216_initial_schema.sql: daily_input_cap between 1 and 200.
    for (const cap of DAILY_CAP_OPTIONS) {
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(cap).toBeLessThanOrEqual(200);
    }
  });
});
