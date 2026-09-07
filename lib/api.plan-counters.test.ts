/**
 * Forma delle query dei due contatori che Add mostra sotto i bottoni
 * (stesso impianto di lib/api.trash.test.ts: il client Supabase e' un
 * registratore, e la query E' il comportamento).
 *
 * I due contatori leggono DUE tetti diversi e non devono confondersi:
 *   - countMemories -> tetto di PIANO (Free = 10 in tutto, cestino compreso):
 *     stesso predicato del trigger memories_enforce_plan_limit (P0004), cioe'
 *     solo user_id. Un `.is("deleted_at", null)` qui farebbe dire al client
 *     "9/10" mentre il server rifiuta, e il rifiuto sembrerebbe un bug.
 *   - fetchTodayInputCount -> cursore GIORNALIERO (Plus/Pro, avviso morbido):
 *     finestra su created_at e, anche qui, NESSUN filtro sul cestino:
 *     eliminare e reinserire non libera quota.
 * Decisione di Angelo del 7/9/2026 ("10 in tutto"); docs/PAYMENTS.md § I piani.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
let results: Result[] = [];

// `vi.mock` e' issato sopra gli import: lo stato che il mock legge deve
// esserlo anche lui, altrimenti la factory vedrebbe una variabile non ancora
// inizializzata. Il getter rende la demo commutabile per singolo test.
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

import { countMemories, fetchTodayInputCount } from "./api";

const callNames = (i: number) => log[i].calls.map(([n]) => n);
const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  results = [];
  state.demo = false;
});

describe("countMemories: il contatore del tetto di piano", () => {
  it("conta TUTTE le righe dell'utente: solo user_id, ne' cestino ne' cartella", async () => {
    results = [{ count: 7 }];
    const n = await countMemories("u1");
    expect(n).toBe(7);
    expect(log).toHaveLength(1);
    expect(log[0].table).toBe("memories");
    // count head: nessuna riga scaricata, solo il numero.
    expect(call(0, "select")).toEqual([["id", { count: "exact", head: true }]]);
    expect(call(0, "eq")).toEqual([["user_id", "u1"]]);
    // Il predicato del trigger e' "user_id = new.user_id" e basta: ogni
    // filtro in piu' qui e' una divergenza dal server.
    expect(callNames(0)).not.toContain("is");
    expect(callNames(0)).not.toContain("not");
    expect(callNames(0)).not.toContain("gte");
    expect(callNames(0)).not.toContain("lte");
    expect(call(0, "eq").map(([col]) => col)).not.toContain("folder_id");
  });

  it("un count nullo vale zero, non un crash", async () => {
    results = [{ count: null }];
    expect(await countMemories("u1")).toBe(0);
  });

  it("in demo vale zero senza toccare Supabase (la demo e' pro)", async () => {
    state.demo = true;
    expect(await countMemories("u1")).toBe(0);
    expect(log).toHaveLength(0);
  });
});

describe("fetchTodayInputCount: il contatore del cursore giornaliero", () => {
  it("conta gli inserimenti di oggi su created_at, cestino COMPRESO", async () => {
    results = [{ count: 3 }];
    const n = await fetchTodayInputCount("u1");
    expect(n).toBe(3);
    expect(log).toHaveLength(1);
    expect(log[0].table).toBe("memories");
    expect(call(0, "select")).toEqual([["id", { count: "exact", head: true }]]);
    expect(call(0, "eq")).toEqual([["user_id", "u1"]]);
    // Finestra del giorno locale: un gte e un lte, entrambi su created_at.
    const gte = call(0, "gte");
    const lte = call(0, "lte");
    expect(gte).toHaveLength(1);
    expect(lte).toHaveLength(1);
    expect(gte[0][0]).toBe("created_at");
    expect(lte[0][0]).toBe("created_at");
    expect(typeof gte[0][1]).toBe("string");
    expect(typeof lte[0][1]).toBe("string");
    expect(String(gte[0][1]) <= String(lte[0][1])).toBe(true);
    // Eliminare e reinserire non deve liberare quota: nessun filtro sul
    // cestino, come per il tetto di piano.
    expect(callNames(0)).not.toContain("is");
    expect(callNames(0)).not.toContain("not");
  });

  it("in demo vale zero senza toccare Supabase", async () => {
    state.demo = true;
    expect(await fetchTodayInputCount("u1")).toBe(0);
    expect(log).toHaveLength(0);
  });
});

describe("i due contatori restano due", () => {
  it("nessuno dei due filtra deleted_at: cestinare non libera ne' il piano ne' il giorno", async () => {
    results = [{ count: 1 }, { count: 1 }];
    await countMemories("u1");
    await fetchTodayInputCount("u1");
    for (const entry of log) {
      const filtered = entry.calls
        .filter(([n]) => n === "is" || n === "not" || n === "eq" || n === "neq")
        .map(([, a]) => a[0]);
      expect(filtered).not.toContain("deleted_at");
    }
  });
});
