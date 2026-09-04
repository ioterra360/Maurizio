/**
 * Query-shape tests per la paginazione delle chiavi foto (lib/api.ts).
 * Stesso recorder di api.trash.test.ts: qui la query È il comportamento.
 *
 * Perché esiste questo file: `fetchPhotoPaths` alimenta l'UNICA operazione
 * irreversibile del piano foto (reconcilePhotos → storage.remove). Una lista
 * referenziata incompleta trasforma foto VIVE in orfani da cancellare, senza
 * modo di riattaccarle. Due modi di renderla incompleta, e il cursore
 * (keyset) li chiude entrambi:
 *
 *  - il server TRONCA la pagina al `max_rows` del progetto, che è
 *    un'impostazione REMOTA (il valore in supabase/config.toml è solo il
 *    Supabase locale e `db push` non lo pubblica);
 *  - l'insieme SI RESTRINGE sotto la scansione, e con un offset ogni riga
 *    successiva scala di una posizione — la pagina dopo ne salta una.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
let results: Result[] = [];
/** Server FINTO che risponde davvero al cursore; null = risposte in scatola. */
let serve: ((calls: Call[]) => Result) | null = null;

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
    const next = serve ? serve(entry.calls) : (results.shift() ?? { data: [], error: null, count: 0 });
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
/** Il cursore di ogni richiesta: `undefined` sulla prima (nessun `gt`). */
const cursors = () => log.map((_, i) => call(i, "gt")[0]);
const limits = () => log.map((_, i) => call(i, "limit")[0]);
/** `from` = indice del PRIMO id, così le pagine successive continuano la serie. */
const rows = (paths: (string | null)[], from = 0) =>
  paths.map((photo_path, i) => ({ id: `id${String(from + i).padStart(4, "0")}`, photo_path }));

beforeEach(() => {
  log.length = 0;
  results = [];
  serve = null;
});

describe("fetchPhotoPaths", () => {
  it("continua a paginare quando il server tronca sotto la pagina richiesta", async () => {
    // max_rows remoto più basso di PAGE: la PRIMA pagina torna corta pur
    // avendo altre righe dietro. Fermarsi qui darebbe una lista referenziata
    // parziale — e reconcilePhotos cancellerebbe le foto rimaste fuori.
    results = [
      { data: rows(["u1/a.jpg", "u1/b.jpg", "u1/c.jpg"]) },
      { data: rows(["u1/d.jpg", "u1/e.jpg", "u1/f.jpg"], 3) },
      { data: [] },
    ];

    const out = await fetchPhotoPaths("u1");

    expect(out).toEqual(["u1/a.jpg", "u1/b.jpg", "u1/c.jpg", "u1/d.jpg", "u1/e.jpg", "u1/f.jpg"]);
    expect(log).toHaveLength(3);
    // Il cursore è l'ultimo id RICEVUTO, non il millesimo chiesto.
    expect(cursors()).toEqual([undefined, ["id", "id0002"], ["id", "id0005"]]);
  });

  it("si ferma solo sulla pagina vuota", async () => {
    results = [{ data: [] }];

    expect(await fetchPhotoPaths("u1")).toEqual([]);
    expect(log).toHaveLength(1);
  });

  it("non si ferma su una pagina piena quanto PAGE", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => `u1/${i}.jpg`);
    results = [{ data: rows(full) }, { data: rows(["u1/last.jpg"], 1000) }, { data: [] }];

    const out = await fetchPhotoPaths("u1");

    expect(out).toHaveLength(1001);
    expect(out[1000]).toBe("u1/last.jpg");
    expect(cursors()).toEqual([undefined, ["id", "id0999"], ["id", "id1000"]]);
    expect(limits()).toEqual([[1000], [1000], [1000]]);
  });

  it("scarta i photo_path null ma li usa come cursore", async () => {
    results = [{ data: rows(["u1/a.jpg", null, "u1/b.jpg"]) }, { data: [] }];

    const out = await fetchPhotoPaths("u1");

    expect(out).toEqual(["u1/a.jpg", "u1/b.jpg"]);
    // Il cursore è l'ULTIMA riga ricevuta anche se la sua foto è null:
    // saltarla vorrebbe dire rileggere in eterno la stessa pagina.
    expect(cursors()).toEqual([undefined, ["id", "id0002"]]);
  });

  it("non salta una chiave quando l'insieme si restringe durante la scansione", async () => {
    // Con la paginazione a OFFSET questo test fallisce: se fra la prima e la
    // seconda pagina sparisce una riga (removeMemoryPhoto da un altro
    // dispositivo, oppure purge_trash che elimina un ricordo con foto) tutte
    // le righe dopo di essa scalano di una posizione, e `range(3, …)` salta
    // esattamente una chiave ANCORA VIVA — che reconcilePhotos poi cancella
    // dal bucket, irreversibilmente. Il cursore riparte da un VALORE.
    const live = [
      { id: "id0", photo_path: "u1/a.jpg" },
      { id: "id1", photo_path: "u1/b.jpg" },
      { id: "id2", photo_path: "u1/c.jpg" },
      { id: "id3", photo_path: "u1/d.jpg" },
      { id: "id4", photo_path: "u1/e.jpg" },
      { id: "id5", photo_path: "u1/f.jpg" },
    ];
    const SERVED = 3; // il max_rows remoto, più basso di PAGE
    let page = 0;
    // Onora ENTRAMBE le paginazioni, così il test è una vera prova: con un
    // `range` risponde come risponderebbe a un offset, e in quel caso
    // fallisce (verificato ripristinando la versione precedente di
    // fetchPhotoPaths: torna [a, b, c, e, f] — "u1/d.jpg" sparisce).
    serve = (calls) => {
      page += 1;
      if (page === 2) live.splice(1, 1); // "u1/b.jpg" sparisce sotto la scansione
      const after = calls.filter(([n]) => n === "gt").map(([, a]) => a[1] as string).pop() ?? null;
      const range = calls.filter(([n]) => n === "range").map(([, a]) => a as [number, number]).pop() ?? null;
      const rest = after === null ? live : live.filter((r) => r.id > after);
      const start = range ? range[0] : 0;
      return { data: rest.slice(start, start + SERVED) };
    };

    const out = await fetchPhotoPaths("u1");

    // Nessun buco: d/e/f ci sono tutte. (b è arrivata prima di sparire: una
    // chiave in più è innocua — reconcilePhotos cancella solo ciò che NON è
    // referenziato — una chiave in meno no.)
    expect(out).toEqual(["u1/a.jpg", "u1/b.jpg", "u1/c.jpg", "u1/d.jpg", "u1/e.jpg", "u1/f.jpg"]);
  });

  it("interroga memories col cursore, ordine stabile, filtro utente e photo_path non nullo", async () => {
    results = [{ data: [] }];

    await fetchPhotoPaths("u1");

    expect(log[0].table).toBe("memories");
    // `id` nella select non è decorativo: è il cursore.
    expect(call(0, "select")).toContainEqual(["id, photo_path"]);
    expect(call(0, "eq")).toContainEqual(["user_id", "u1"]);
    expect(call(0, "not")).toContainEqual(["photo_path", "is", null]);
    // Senza un order stabile il cursore non definisce nessuna "pagina dopo".
    expect(call(0, "order")).toContainEqual(["id", { ascending: true }]);
    expect(call(0, "limit")).toContainEqual([1000]);
    // Nessun offset: è la posizione a scalare quando l'insieme si restringe.
    expect(call(0, "range")).toHaveLength(0);
    // La prima pagina non ha un cursore da cui ripartire.
    expect(call(0, "gt")).toHaveLength(0);
  });

  it("propaga l'errore invece di restituire una lista parziale", async () => {
    results = [{ data: rows(["u1/a.jpg"]) }, { error: { message: "boom" } }];

    await expect(fetchPhotoPaths("u1")).rejects.toMatchObject({ message: "boom" });
  });
});
