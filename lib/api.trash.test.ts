/**
 * Query-shape tests for the Cestino (soft delete) layer of lib/api.ts.
 * The Supabase client is replaced by a recorder: these tests pin down WHICH
 * tables and filters each function uses — the query IS the behavior here
 * (a missing `.is("deleted_at", null)` silently resurrects trashed rows).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
const rpcLog: Array<{ fn: string; args?: unknown }> = [];
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
    "eq", "neq", "is", "not", "or", "lt", "lte", "gt", "gte",
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
    rpc: (fn: string, args?: unknown) => {
      rpcLog.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

import {
  cancelAccountDeletion,
  createFolder,
  deleteFolder,
  fetchReviewCount,
  deleteMemory,
  fetchDueMemoriesByLayer,
  fetchFolders,
  fetchTrash,
  requestAccountDeletion,
  restoreFolder,
  restoreMemory,
} from "./api";

const callNames = (i: number) => log[i].calls.map(([n]) => n);
const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  rpcLog.length = 0;
  results = [];
});

describe("trash filters on reads", () => {
  it("fetchFolders excludes trashed folders", async () => {
    await fetchFolders("u1");
    expect(log[0].table).toBe("folders");
    expect(call(0, "is")).toContainEqual(["deleted_at", null]);
  });

  it("fetchDueMemoriesByLayer excludes trashed memories from the queue", async () => {
    results = [{ data: [] }, { data: [] }]; // pausedFolderIds + the query
    await fetchDueMemoriesByLayer("u1", "scan");
    const memoriesQuery = log.find((l) => l.table === "memories");
    expect(memoriesQuery).toBeDefined();
    expect(memoriesQuery!.calls.filter(([n]) => n === "is").map(([, a]) => a)).toContainEqual([
      "deleted_at",
      null,
    ]);
  });
});

describe("soft delete", () => {
  it("deleteFolder marks the folder AND its memories, never row-deletes", async () => {
    await deleteFolder("f1");
    const tables = log.map((l) => l.table);
    expect(tables).toContain("memories");
    expect(tables).toContain("folders");
    for (const l of log) {
      expect(l.calls.map(([n]) => n)).not.toContain("delete");
      const updates = l.calls.filter(([n]) => n === "update");
      expect(updates).toHaveLength(1);
      const payload = updates[0][1][0] as Record<string, unknown>;
      expect(typeof payload.deleted_at).toBe("string");
    }
    // memories are marked BEFORE the folder so a failure can't leave a
    // hidden folder with live memories (the purge cascade would eat them).
    expect(log[0].table).toBe("memories");
    expect(call(0, "eq")).toContainEqual(["folder_id", "f1"]);
    expect(call(0, "is")).toContainEqual(["deleted_at", null]);
    expect(call(1, "eq")).toContainEqual(["id", "f1"]);
  });

  it("deleteMemory marks the row instead of deleting it", async () => {
    await deleteMemory("m1");
    expect(log[0].table).toBe("memories");
    expect(callNames(0)).not.toContain("delete");
    const payload = call(0, "update")[0][0] as Record<string, unknown>;
    expect(typeof payload.deleted_at).toBe("string");
  });
});

describe("restore", () => {
  it("restoreFolder clears the folder and every trashed memory inside it", async () => {
    await restoreFolder("f1");
    expect(log[0].table).toBe("folders");
    expect(call(0, "update")[0][0]).toEqual({ deleted_at: null });
    expect(call(0, "eq")).toContainEqual(["id", "f1"]);
    expect(log[1].table).toBe("memories");
    expect(call(1, "update")[0][0]).toEqual({ deleted_at: null });
    expect(call(1, "eq")).toContainEqual(["folder_id", "f1"]);
    expect(call(1, "not")).toContainEqual(["deleted_at", "is", null]);
  });

  it("restoreMemory restores a trashed folder BEFORE reviving the memory", async () => {
    results = [
      { data: { id: "m1", folder_id: "f9" } }, // the memory row (unfiltered read)
      { data: { id: "f9", deleted_at: "2026-08-30T10:00:00Z" } }, // folder row
      {}, // folder update
      {}, // memory update
    ];
    await restoreMemory("m1");
    const updates = log
      .map((l, i) => ({ i, table: l.table, isUpdate: l.calls.some(([n]) => n === "update") }))
      .filter((x) => x.isUpdate);
    // Folder first, memory last: a failure in between leaves a trashed
    // memory in a LIVE folder (safe), never a live memory in a trashed one
    // (the folder purge cascade would eat it).
    expect(updates.map((x) => x.table)).toEqual(["folders", "memories"]);
    const folderUpdate = log[updates[0].i];
    expect(folderUpdate.calls.filter(([n]) => n === "update").map(([, a]) => a)[0][0]).toEqual({
      deleted_at: null,
    });
  });

  it("restoreMemory leaves a live folder untouched", async () => {
    results = [
      { data: { id: "m1", folder_id: "f9" } },
      { data: { id: "f9", deleted_at: null } },
      {},
    ];
    await restoreMemory("m1");
    const folderUpdates = log.filter(
      (l) => l.table === "folders" && l.calls.some(([n]) => n === "update"),
    );
    expect(folderUpdates).toHaveLength(0);
  });

  it("createFolder RESURRECTS a trashed same-kind folder instead of hard-deleting it", async () => {
    results = [
      { data: [] }, // fetchFolders (live folders, for priority)
      { data: { id: "fOld", deleted_at: "2026-08-30T09:00:00Z" } }, // trashed same-kind lookup
      {}, // stale subfolders cleanup
      { data: {
        id: "fOld", user_id: "u1", kind: "es", name: "Nuovo nome", priority: 1,
        color: null, icon: null, paused: false, deleted_at: null,
        created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-30T11:00:00Z",
      } }, // resurrect update returning the row
    ];
    const folder = await createFolder("u1", { kind: "es", name: "Nuovo nome", itemTypes: [] });
    expect(folder.id).toBe("fOld");
    // The old MEMORIES keep their 24h window (no delete on memories/folders);
    // the old SECTIONS instead die with the revive — the "new" folder must
    // not inherit phantom chips that eat the max-3 budget.
    for (const l of log) {
      if (l.table === "subfolders") continue;
      expect(l.calls.map(([n]) => n)).not.toContain("delete");
    }
    const subCleanup = log.find((l) => l.table === "subfolders" && l.calls.some(([n]) => n === "delete"));
    expect(subCleanup).toBeDefined();
    expect(subCleanup!.calls.filter(([n]) => n === "eq").map(([, a]) => a)).toContainEqual([
      "folder_id",
      "fOld",
    ]);
    const resurrect = log.find((l) => l.table === "folders" && l.calls.some(([n]) => n === "update"));
    expect(resurrect).toBeDefined();
    const payload = resurrect!.calls.filter(([n]) => n === "update").map(([, a]) => a)[0][0] as Record<string, unknown>;
    expect(payload.deleted_at).toBeNull();
    expect(payload.name).toBe("Nuovo nome");
  });

  it("fetchReviewCount counts review_items rows for the memory", async () => {
    results = [{ count: 12 }];
    const n = await fetchReviewCount("m1");
    expect(n).toBe(12);
    expect(log[0].table).toBe("review_items");
    expect(call(0, "eq")).toContainEqual(["memory_id", "m1"]);
  });
});

describe("trash listing", () => {
  it("fetchTrash splits folder-trashed memories from standalone ones", async () => {
    const mem = (id: string, folderId: string, deletedAt: string) => ({
      id, user_id: "u1", folder_id: folderId, term: id, reading: null,
      definition: "d", example: null, item_type: null, state: "active",
      srs_interval_days: 1, srs_ease_factor: 2.5, srs_repetitions: 0,
      last_reviewed_at: null, next_review_at: "2026-08-30T00:00:00Z",
      deleted_at: deletedAt, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    });
    const folder = (id: string, deletedAt: string | null) => ({
      id, user_id: "u1", kind: "es", name: `folder-${id}`, priority: 1,
      color: null, icon: null, paused: false, deleted_at: deletedAt,
      created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    });
    results = [
      { data: [folder("fDel", "2026-08-30T09:00:00Z"), folder("fLive", null)] },
      { data: [
        mem("a", "fDel", "2026-08-30T09:00:00Z"), // trashed WITH the folder
        mem("b", "fLive", "2026-08-30T10:00:00Z"), // folder alive → standalone
        mem("c", "fDel", "2026-08-30T05:00:00Z"), // trashed BEFORE the folder → purges sooner → standalone
      ] },
    ];
    const trash = await fetchTrash("u1");
    expect(trash.folders).toHaveLength(1);
    expect(trash.folders[0].id).toBe("fDel");
    expect(trash.folders[0].memoryCount).toBe(1);
    expect(trash.memories.map((m) => m.id).sort()).toEqual(["b", "c"]);
    expect(trash.memories.find((m) => m.id === "b")!.folderName).toBe("folder-fLive");
    expect(trash.memories.find((m) => m.id === "c")!.folderName).toBe("folder-fDel");
  });
});

describe("account deletion grace", () => {
  it("requestAccountDeletion calls the grace RPC, not delete_own_account", async () => {
    await requestAccountDeletion();
    expect(rpcLog).toEqual([{ fn: "request_account_deletion", args: undefined }]);
  });

  it("cancelAccountDeletion calls its RPC", async () => {
    await cancelAccountDeletion();
    expect(rpcLog).toEqual([{ fn: "cancel_account_deletion", args: undefined }]);
  });
});
