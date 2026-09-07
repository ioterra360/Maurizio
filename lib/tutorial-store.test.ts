import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// report-error importa @sentry/react-native, che importa il react-native
// vero (non lo stub). I rami catch non sono esercitati qui.
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

import { TUTORIAL_STORAGE_KEY, useTutorialStore } from "./tutorial-store";

describe("tutorial store", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
    useTutorialStore.setState({ seen: false, hydrated: false });
  });

  it("parte come mai visto e non idratato", () => {
    expect(useTutorialStore.getState()).toMatchObject({ seen: false, hydrated: false });
    expect(TUTORIAL_STORAGE_KEY).toBe("memika.tutorial.v1");
  });

  it("markSeen segna e persiste", async () => {
    useTutorialStore.getState().markSeen();
    expect(useTutorialStore.getState().seen).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse((await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY)) ?? "{}")).toEqual({ seen: true });
  });

  it("idrata dallo storage", async () => {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ seen: true }));
    await useTutorialStore.getState().hydrate();
    expect(useTutorialStore.getState()).toMatchObject({ seen: true, hydrated: true });
  });

  it("scarta un valore non booleano e un JSON rotto senza lanciare", async () => {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ seen: "yes" }));
    await useTutorialStore.getState().hydrate();
    expect(useTutorialStore.getState()).toMatchObject({ seen: false, hydrated: true });

    useTutorialStore.setState({ seen: false, hydrated: false });
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, "{not json");
    await expect(useTutorialStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useTutorialStore.getState()).toMatchObject({ seen: false, hydrated: true });
  });

  it("un markSeen arrivato mentre lo storage rispondeva vince sulla snapshot", async () => {
    await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ seen: false }));
    useTutorialStore.setState({ seen: true });
    await useTutorialStore.getState().hydrate();
    expect(useTutorialStore.getState().seen).toBe(true);
  });
});
