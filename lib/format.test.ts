import { describe, expect, it as test, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  I18nManager: { getConstants: () => ({ localeIdentifier: "it_IT" }) },
  NativeModules: {},
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

import { relativeReviewed } from "./format";
import { useLocaleStore } from "./i18n";

// Local-time dates: the label is about the user's calendar, not 24 h windows.
const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe("relativeReviewed — calendar days in local time", () => {
  useLocaleStore.setState({ locale: "it" });

  test("a review yesterday evening reads Ieri the next afternoon (19 h apart)", () => {
    const then = local(2026, 8, 28, 20, 0);
    const now = local(2026, 8, 29, 15, 0);
    expect(relativeReviewed(then.toISOString(), now)).toBe("Ieri");
  });

  test("a review earlier the same day reads Oggi even 22 h later", () => {
    const then = local(2026, 8, 29, 1, 0);
    const now = local(2026, 8, 29, 23, 0);
    expect(relativeReviewed(then.toISOString(), now)).toBe("Oggi");
  });

  test("two calendar days back reads 2 giorni fa even if only 26 h passed", () => {
    const then = local(2026, 8, 27, 23, 0);
    const now = local(2026, 8, 29, 1, 0);
    expect(relativeReviewed(then.toISOString(), now)).toBe("2 giorni fa");
  });

  test("a timestamp slightly in the future (clock skew) reads Adesso", () => {
    const now = local(2026, 8, 29, 12, 0);
    const then = new Date(now.getTime() + 30_000);
    expect(relativeReviewed(then.toISOString(), now)).toBe("Adesso");
  });

  test("null or garbage reads the never-reviewed label", () => {
    expect(relativeReviewed(null)).toBe("Mai ripassato");
    expect(relativeReviewed("not-a-date")).toBe("Mai ripassato");
  });
});
