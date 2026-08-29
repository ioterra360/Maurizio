import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// report-error imports @sentry/react-native, which imports the real
// react-native (not the vitest stub). The store's catch paths are not
// exercised here, so a mock keeps the suite loadable.
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

import { useFolderSortStore } from "./folder-sort-store";

describe("folder sort store", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem("memika.folder-sort.v1");
    useFolderSortStore.setState({ byKind: {}, hydrated: false });
  });

  it("defaults to 'due' for a folder with no saved choice", () => {
    expect(useFolderSortStore.getState().sortFor("es")).toBe("due");
  });

  it("remembers the choice per folder and persists it", async () => {
    useFolderSortStore.getState().setSort("es", "alpha");
    expect(useFolderSortStore.getState().sortFor("es")).toBe("alpha");
    expect(useFolderSortStore.getState().sortFor("jp")).toBe("due");
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem("memika.folder-sort.v1");
    expect(JSON.parse(raw ?? "{}")).toEqual({ es: "alpha" });
  });

  it("hydrates from storage and drops unknown values", async () => {
    await AsyncStorage.setItem("memika.folder-sort.v1", JSON.stringify({ jp: "newest", law: "garbage" }));
    await useFolderSortStore.getState().hydrate();
    expect(useFolderSortStore.getState().sortFor("jp")).toBe("newest");
    expect(useFolderSortStore.getState().sortFor("law")).toBe("due");
    expect(useFolderSortStore.getState().hydrated).toBe(true);
  });
});
