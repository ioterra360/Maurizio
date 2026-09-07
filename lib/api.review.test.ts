/**
 * Query-shape tests per la persistenza dei ripassi (lib/api.ts): lo stato
 * scritto dopo una risposta e i filtri delle sessioni di cartella e di
 * recupero. Stesso registratore di lib/api.trash.test.ts.
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
  isDemoMode: false,
  supabase: { from: (table: string) => makeBuilder(table) },
}));

import { applyPhaseUpdate, fetchDueMemoriesByLayer } from "./api";

const call = (i: number, name: string) =>
  log[i]!.calls.filter(([n]) => n === name).map(([, args]) => args);
const has = (i: number, name: string) => log[i]!.calls.some(([n]) => n === name);

beforeEach(() => {
  log.length = 0;
  results = [];
});

describe("applyPhaseUpdate", () => {
  it("scrive sempre state = active: la finestra nuova non e' in ritardo, il ritardo si calcola alla lettura", async () => {
    await applyPhaseUpdate(
      "m1",
      {
        phase: "p48h",
        nextReviewAt: "2026-09-10T10:00:00.000Z",
        reviewWindowEnd: "2026-09-11T10:00:00.000Z",
        recoveryFrom: null,
        lastReviewedAt: "2026-09-08T10:00:00.000Z",
      },
      "remembered",
    );
    expect(log[0]!.table).toBe("memories");
    const payload = call(0, "update")[0]![0] as Record<string, unknown>;
    expect(payload.state).toBe("active");
    expect(payload.review_phase).toBe("p48h");
    expect(payload.last_reviewed_at).toBe("2026-09-08T10:00:00.000Z");
    // Il contatore lo tiene il trigger: il client non lo tocca.
    expect(payload).not.toHaveProperty("review_count");
  });
});

describe("fetchDueMemoriesByLayer", () => {
  it("di default affetta per le fasi del livello", async () => {
    await fetchDueMemoriesByLayer("u1", "scan", { folderId: "f1" });
    expect(has(0, "in")).toBe(true);
    expect(has(0, "lt")).toBe(false);
  });

  it("allPhases: la sessione di una cartella prende tutta la coda, senza filtro di fase", async () => {
    await fetchDueMemoriesByLayer("u1", "focus", { folderId: "f1", allPhases: true });
    expect(has(0, "in")).toBe(false);
    expect(call(0, "eq")).toContainEqual(["folder_id", "f1"]);
    expect(call(0, "lte")[0]![0]).toBe("next_review_at");
  });

  it("overdueOnly: solo le carte con la finestra gia' scaduta (Riequilibra ora)", async () => {
    await fetchDueMemoriesByLayer("u1", "focus", { folderId: "f1", allPhases: true, overdueOnly: true });
    const lt = call(0, "lt");
    expect(lt).toHaveLength(1);
    expect(lt[0]![0]).toBe("review_window_end");
  });
});
