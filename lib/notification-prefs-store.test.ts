import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// report-error importa @sentry/react-native, che importa il react-native
// vero (non lo stub). I rami catch non sono esercitati qui.
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

import { DEFAULT_NOTIFICATION_PREFS, useNotificationPrefsStore } from "./notification-prefs-store";

const KEY = "memika.notifications.v1";

describe("notification prefs store", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(KEY);
    useNotificationPrefsStore.setState({ prefs: DEFAULT_NOTIFICATION_PREFS, hydrated: false });
  });

  it("parte spento, con Avvisami acceso e prompt mai mostrato", () => {
    expect(useNotificationPrefsStore.getState().prefs).toEqual({
      enabled: false,
      firstReview: true,
      promptSeen: false,
    });
  });

  it("applica una patch parziale e la persiste", async () => {
    useNotificationPrefsStore.getState().setPrefs({ enabled: true });
    expect(useNotificationPrefsStore.getState().prefs).toEqual({ enabled: true, firstReview: true, promptSeen: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}")).toEqual({
      enabled: true,
      firstReview: true,
      promptSeen: false,
    });
  });

  it("idrata dallo storage e scarta i valori non booleani", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ enabled: true, firstReview: "no", promptSeen: 1, extra: true }));
    await useNotificationPrefsStore.getState().hydrate();
    expect(useNotificationPrefsStore.getState().prefs).toEqual({ enabled: true, firstReview: true, promptSeen: false });
    expect(useNotificationPrefsStore.getState().hydrated).toBe(true);
  });

  it("una scelta fatta mentre lo storage rispondeva vince sulla snapshot", async () => {
    // La scelta viva si scrive direttamente nello store, SENZA passare da
    // setPrefs: la sua persist() sovrascriverebbe subito il seme (lo stub
    // AsyncStorage scrive in modo sincrono) e hydrate rileggerebbe già
    // enabled:true, lasciando il ramo "changed vince" non esercitato.
    await AsyncStorage.setItem(KEY, JSON.stringify({ enabled: false }));
    useNotificationPrefsStore.setState({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, enabled: true } });
    await useNotificationPrefsStore.getState().hydrate();
    expect(useNotificationPrefsStore.getState().prefs.enabled).toBe(true);
  });
});
