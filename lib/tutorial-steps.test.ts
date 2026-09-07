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
import { LAYER_ROWS, TUTORIAL_STEPS, pageIndex } from "./tutorial-steps";

describe("tutorial steps", () => {
  test("cinque passi con chiavi uniche: saltabile in un tocco, resta corto", () => {
    expect(TUTORIAL_STEPS).toHaveLength(5);
    const keys = TUTORIAL_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("ogni titolo e corpo esiste nel catalogo italiano", () => {
    for (const s of TUTORIAL_STEPS) {
      expect(it, s.key).toHaveProperty(s.titleKey);
      expect(it, s.key).toHaveProperty(s.bodyKey);
    }
  });

  test("mai la mascotte default a dimensione hero", () => {
    for (const s of TUTORIAL_STEPS) expect(s.mascot).not.toBe("default");
  });

  test("i tre ritmi restano nell'ordine bloccato Scan, Reinforcement, Focus, con le loro chiavi", () => {
    expect(LAYER_ROWS).toEqual(["scan", "reinforcement", "focus"]);
    for (const l of LAYER_ROWS) {
      expect(it).toHaveProperty(`onboarding.${l}Title`);
      expect(it).toHaveProperty(`onboarding.${l}Body`);
    }
    expect(TUTORIAL_STEPS.filter((s) => s.layers)).toHaveLength(1);
  });

  test("pageIndex arrotonda alla pagina più vicina e non esce dai passi", () => {
    expect(pageIndex(0, 360, 5)).toBe(0);
    expect(pageIndex(179, 360, 5)).toBe(0);
    expect(pageIndex(180, 360, 5)).toBe(1);
    expect(pageIndex(360 * 3.7, 360, 5)).toBe(4);
    expect(pageIndex(360 * 9, 360, 5)).toBe(4);
    expect(pageIndex(-40, 360, 5)).toBe(0);
    expect(pageIndex(100, 0, 5)).toBe(0);
  });
});
