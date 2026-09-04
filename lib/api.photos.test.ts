/**
 * Query-shape tests per la paginazione delle chiavi foto (lib/api.ts).
 * Stesso recorder di api.trash.test.ts: qui la query È il comportamento.
 *
 * Perché esiste questo file: `fetchPhotoPaths` alimenta l'UNICA operazione
 * irreversibile del piano foto (reconcilePhotos → storage.remove). Una lista
 * referenziata tronca trasforma foto VIVE in orfani da cancellare, senza modo
 * di riattaccarle. Il ciclo quindi non deve assumere di conoscere il
 * `max_rows` del progetto (impostazione REMOTA: il valore in
 * supabase/config.toml è solo il Supabase locale e `db push` non lo pubblica).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
let results: Result[] = [];

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
    "eq", "neq", "is", "not", "or", "lt", "lte", "gt", "gte", "in",
    "order", "limit", "range", "returns", "maybeSingle", "single",
  ]) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (r: Result) => void, reject?: (e: unknown) => void) => {
    const next = results.shift() ?? { data: [], error: null, count: 0 };
    return Promise.resolve({ data: null, error: null, count: null, ...next }).then(resolve, reject);
  };
  return builder;
}

vi.mock("./supabase", () => ({
  isDemoMode: false,
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { fetchPhotoPaths } from "./api";

const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);
const ranges = () => log.map((_, i) => call(i, "range")[0]);
const rows = (paths: (string | null)[]) => paths.map((photo_path) => ({ photo_path }));

beforeEach(() => {
  log.length = 0;
  results = [];
});

describe("fetchPhotoPaths", () => {
  it("continua a paginare quando il server tronca sotto la pagina richiesta", async () => {
    // max_rows remoto più basso di PAGE: la PRIMA pagina torna corta pur
    // avendo altre righe dietro. Fermarsi qui darebbe una lista referenziata
    // parziale — e reconcilePhotos cancellerebbe le foto rimaste fuori.
    results = [
      { data: rows(["u1/a.jpg", "u1/b.jpg", "u1/c.jpg"]) },
      { data: rows(["u1/d.jpg", "u1/e.jpg", "u1/f.jpg"]) },
      { data: [] },
    ];

    const out = await fetchPhotoPaths("u1");

    expect(out).toEqual(["u1/a.jpg", "u1/b.jpg", "u1/c.jpg", "u1/d.jpg", "u1/e.jpg", "u1/f.jpg"]);
    expect(log).toHaveLength(3);
    // L'offset avanza di quante righe sono ARRIVATE, non di quante ne ho chieste.
    expect(ranges()).toEqual([[0, 999], [3, 1002], [6, 1005]]);
  });

  it("si ferma solo sulla pagina vuota", async () => {
    results = [{ data: [] }];

    expect(await fetchPhotoPaths("u1")).toEqual([]);
    expect(log).toHaveLength(1);
  });

  it("non si ferma su una pagina piena quanto PAGE", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => `u1/${i}.jpg`);
    results = [{ data: rows(full) }, { data: rows(["u1/last.jpg"]) }, { data: [] }];

    const out = await fetchPhotoPaths("u1");

    expect(out).toHaveLength(1001);
    expect(out[1000]).toBe("u1/last.jpg");
    expect(ranges()).toEqual([[0, 999], [1000, 1999], [1001, 2000]]);
  });

  it("scarta i photo_path null ma li conta nell'offset", async () => {
    results = [{ data: rows(["u1/a.jpg", null, "u1/b.jpg"]) }, { data: [] }];

    const out = await fetchPhotoPaths("u1");

    expect(out).toEqual(["u1/a.jpg", "u1/b.jpg"]);
    // 3 righe ricevute → si riparte da 3, altrimenti la riga null verrebbe
    // riletta all'infinito.
    expect(ranges()).toEqual([[0, 999], [3, 1002]]);
  });

  it("interroga memories con ordine stabile, filtro utente e photo_path non nullo", async () => {
    results = [{ data: [] }];

    await fetchPhotoPaths("u1");

    expect(log[0].table).toBe("memories");
    expect(call(0, "select")).toContainEqual(["photo_path"]);
    expect(call(0, "eq")).toContainEqual(["user_id", "u1"]);
    expect(call(0, "not")).toContainEqual(["photo_path", "is", null]);
    // Senza un order stabile le pagine si sovrappongono e il buco resta.
    expect(call(0, "order")).toContainEqual(["id", { ascending: true }]);
  });

  it("propaga l'errore invece di restituire una lista parziale", async () => {
    results = [{ data: rows(["u1/a.jpg"]) }, { error: { message: "boom" } }];

    await expect(fetchPhotoPaths("u1")).rejects.toMatchObject({ message: "boom" });
  });
});
