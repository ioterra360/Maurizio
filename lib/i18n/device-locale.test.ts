import { describe, expect, it as test, vi } from "vitest";

// iOS under the New Architecture: NativeModules.SettingsManager.settings is
// undefined (TurboModule host objects expose no plain `settings` property),
// so the device locale must come from the `Settings` API.
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  I18nManager: { getConstants: () => ({}) },
  NativeModules: {},
  Settings: {
    get: (key: string) => (key === "AppleLocale" ? "it_IT" : key === "AppleLanguages" ? ["it-IT", "en-US"] : undefined),
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

import { detectDeviceLocale } from "./index";

describe("detectDeviceLocale on iOS (New Architecture)", () => {
  test("reads AppleLocale through Settings.get, not NativeModules", () => {
    expect(detectDeviceLocale()).toBe("it");
  });
});
