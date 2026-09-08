/**
 * Forma della query di fetchEarliestDueAt, il solo dato dietro il
 * promemoria "solo nei giorni con qualcosa in coda" (spec 2026-09-08).
 * Stesso impianto registratore di lib/api.plan-counters.test.ts: il client
 * Supabase e' un mock che registra la catena di chiamate, e la query E' il
 * comportamento.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
let results: Result[] = [];
const state = vi.hoisted(() => ({ demo: false }));

function makeBuilder(table: string) {
  const entry = { table, calls: [] as Call[] };
  log.push(entry);
  const builder: Record<string, unknown> = {};
  const chain = (name: string) =>
    ((...args: unknown[]) => {
      entry.calls.push([name, args]);
      return builder;
    });
  for (const m of [
    "select", "update", "delete", "insert", "upsert",
    "eq", "neq", "is", "in", "not", "or", "lt", "lte", "gt", "gte",
    "order", "limit", "returns", "maybeSingle", "single",
  ]) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (r: Result) => void) => {
    const next = results.shift() ?? { data: [], error: null, count: 0 };
    return Promise.resolve({ data: null, error: null, count: null, ...next }).then(resolve);
  };
  return builder;
}

vi.mock("./supabase", () => ({
  get isDemoMode() {
    return state.demo;
  },
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { fetchEarliestDueAt } from "./api";

const callNames = (i: number) => log[i].calls.map(([n]) => n);
const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  results = [];
  state.demo = false;
});

describe("fetchEarliestDueAt", () => {
  it("prende la prima next_review_at fra i ricordi vivi e non archiviati, in ordine", async () => {
    results = [{ data: [] }, { data: [{ next_review_at: "2026-09-10T06:00:00.000Z" }] }];
    expect(await fetchEarliestDueAt("u1")).toBe("2026-09-10T06:00:00.000Z");
    expect(log.map((l) => l.table)).toEqual(["folders", "memories"]);
    expect(call(1, "select")).toEqual([["next_review_at"]]);
    expect(call(1, "eq")).toEqual([["user_id", "u1"]]);
    expect(call(1, "is")).toEqual([["deleted_at", null]]);
    expect(call(1, "neq")).toEqual([["state", "archived"]]);
    // Niente is-not-null: ORDER BY ASC mette i NULL in fondo, la prima riga
    // e' una data se ne esiste una. Senza cartelle in pausa nessun "not".
    expect(callNames(1)).not.toContain("not");
    expect(call(1, "order")).toEqual([["next_review_at"]]);
    expect(call(1, "limit")).toEqual([[1]]);
    // Niente confronto con "adesso": il chiamante decide per QUALE istante
    // il ricordo e' in coda (uno slot futuro), non per l'istante della query.
    expect(callNames(1)).not.toContain("lte");
    expect(callNames(1)).not.toContain("lt");
  });

  it("esclude le cartelle in pausa come la coda di Oggi", async () => {
    results = [{ data: [{ id: "f1" }, { id: "f2" }] }, { data: [] }];
    expect(await fetchEarliestDueAt("u1")).toBeNull();
    expect(call(1, "not")).toContainEqual(["folder_id", "in", "(f1,f2)"]);
  });

  it("senza righe torna null, non una stringa vuota", async () => {
    results = [{ data: [] }, { data: [] }];
    expect(await fetchEarliestDueAt("u1")).toBeNull();
  });

  it("in demo vale null senza toccare Supabase", async () => {
    state.demo = true;
    expect(await fetchEarliestDueAt("u1")).toBeNull();
    expect(log).toHaveLength(0);
  });

  it("un errore PostgREST si propaga", async () => {
    results = [{ data: [] }, { data: null, error: new Error("boom") }];
    await expect(fetchEarliestDueAt("u1")).rejects.toThrow("boom");
  });
});
