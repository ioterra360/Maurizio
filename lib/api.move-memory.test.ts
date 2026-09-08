/**
 * Forma della query di moveMemory (lib/api.ts): stesso impianto registratore
 * di api.trash.test.ts, la query costruita E' il comportamento. Le sezioni
 * (sottocartelle) sono uscite dall'app il 8/9/2026: uno spostamento va
 * sempre alla radice della cartella e azzera subfolder_id.
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
  isDemoMode: false,
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { moveMemory } from "./api";

const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  results = [];
});

describe("moveMemory", () => {
  it("sposta alla radice dell'altra cartella: folder_id impostato, subfolder_id azzerato", async () => {
    await moveMemory("m1", { folderId: "f2" });
    expect(log[0].table).toBe("memories");
    expect(call(0, "update")[0][0]).toEqual({ folder_id: "f2", subfolder_id: null });
    expect(call(0, "eq")).toContainEqual(["id", "m1"]);
  });

  it("un errore PostgREST si propaga", async () => {
    results = [{ data: null, error: new Error("boom") }];
    await expect(moveMemory("m1", { folderId: "f2" })).rejects.toThrow("boom");
  });
});
