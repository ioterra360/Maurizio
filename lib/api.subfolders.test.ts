/**
 * Query-shape tests for subfolders + move-memory (lib/api.ts). Same recorder
 * pattern as api.trash.test.ts: the built query IS the unit behavior.
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

import {
  createSubfolder,
  deleteSubfolder,
  fetchSubfolders,
  moveMemory,
  renameSubfolder,
} from "./api";

const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  results = [];
});

const subRow = (id: string, name: string, position = 1) => ({
  id, user_id: "u1", folder_id: "f1", name, position,
  created_at: "2026-08-31T00:00:00Z", updated_at: "2026-08-31T00:00:00Z",
});

describe("subfolders CRUD", () => {
  it("fetchSubfolders reads the folder's sections ordered by position", async () => {
    results = [{ data: [subRow("s1", "Italiano"), subRow("s2", "English", 2)] }];
    const subs = await fetchSubfolders("f1");
    expect(log[0].table).toBe("subfolders");
    expect(call(0, "eq")).toContainEqual(["folder_id", "f1"]);
    expect(call(0, "order").length).toBeGreaterThan(0);
    expect(subs.map((s) => s.name)).toEqual(["Italiano", "English"]);
  });

  it("createSubfolder inserts with user, folder, trimmed name and next position", async () => {
    results = [
      { data: [subRow("s1", "Italiano", 1)] }, // existing, for position
      { data: subRow("s2", "English", 2) },    // insert returning
    ];
    const sub = await createSubfolder("u1", "f1", "  English  ");
    expect(sub.name).toBe("English");
    const insertTables = log.filter((l) => l.calls.some(([n]) => n === "insert"));
    expect(insertTables).toHaveLength(1);
    const payload = insertTables[0].calls.filter(([n]) => n === "insert").map(([, a]) => a)[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ user_id: "u1", folder_id: "f1", name: "English", position: 2 });
  });

  it("renameSubfolder updates the trimmed name by id", async () => {
    await renameSubfolder("s1", " Spagnolo ");
    expect(log[0].table).toBe("subfolders");
    expect(call(0, "update")[0][0]).toMatchObject({ name: "Spagnolo" });
    expect(call(0, "eq")).toContainEqual(["id", "s1"]);
  });

  it("deleteSubfolder row-deletes (memories fall back to the folder root at the DB)", async () => {
    await deleteSubfolder("s1");
    expect(log[0].table).toBe("subfolders");
    expect(log[0].calls.map(([n]) => n)).toContain("delete");
    expect(call(0, "eq")).toContainEqual(["id", "s1"]);
  });
});

describe("moveMemory", () => {
  it("moves to another folder's root: folder_id set, subfolder_id cleared", async () => {
    await moveMemory("m1", { folderId: "f2" });
    expect(log[0].table).toBe("memories");
    expect(call(0, "update")[0][0]).toEqual({ folder_id: "f2", subfolder_id: null });
    expect(call(0, "eq")).toContainEqual(["id", "m1"]);
  });

  it("moves into a subfolder of the target folder", async () => {
    await moveMemory("m1", { folderId: "f1", subfolderId: "s2" });
    expect(call(0, "update")[0][0]).toEqual({ folder_id: "f1", subfolder_id: "s2" });
  });
});
