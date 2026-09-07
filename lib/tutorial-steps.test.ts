import { describe, expect, it as test, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  I18nManager: { getConstants: () => ({ localeIdentifier: "it_IT" }) },
  NativeModules: {},
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

import { it } from "./i18n/it";
import { TUTORIAL_SHOTS } from "./tutorial-shots";
import { TUTORIAL_STEPS, pageIndex } from "./tutorial-steps";

describe("tutorial steps", () => {
  test("sette passi con chiavi uniche: la mascotte si presenta, poi sei schermate", () => {
    expect(TUTORIAL_STEPS).toHaveLength(7);
    const keys = TUTORIAL_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TUTORIAL_STEPS[0]?.shot).toBeUndefined();
    expect(TUTORIAL_STEPS.slice(1).every((s) => s.shot !== undefined)).toBe(true);
  });

  test("ogni titolo e corpo esiste nel catalogo italiano", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(it, s.key).toHaveProperty(s.titleKey);
      expect(it, s.key).toHaveProperty(s.bodyKey);
    }
  });

  test("ogni screenshot e' fra quelli catturati, e tutti quelli catturati servono", () => {
    const used = TUTORIAL_STEPS.flatMap((s) => (s.shot ? [s.shot] : []));
    for (const shot of used) expect(TUTORIAL_SHOTS).toContain(shot);
    expect(new Set(used).size).toBe(TUTORIAL_SHOTS.length);
  });

  test("mai la mascotte default a dimensione hero", () => {
    for (const s of TUTORIAL_STEPS) expect(s.mascot).not.toBe("default");
  });

  test("pageIndex arrotonda alla pagina più vicina e non esce dai passi", () => {
    expect(pageIndex(0, 360, 7)).toBe(0);
    expect(pageIndex(179, 360, 7)).toBe(0);
    expect(pageIndex(180, 360, 7)).toBe(1);
    expect(pageIndex(360 * 5.7, 360, 7)).toBe(6);
    expect(pageIndex(360 * 9, 360, 7)).toBe(6);
    expect(pageIndex(-40, 360, 7)).toBe(0);
    expect(pageIndex(100, 0, 7)).toBe(0);
  });
});
