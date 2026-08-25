import { describe, expect, it } from "vitest";

import { resolveDemoMode } from "./demo-mode";

describe("resolveDemoMode", () => {
  describe("release builds (isDev = false)", () => {
    it("uses real auth when credentials are present", () => {
      expect(resolveDemoMode({ hasCreds: true, forceFlag: false, isDev: false })).toEqual({
        demo: false,
        reason: "real",
      });
    });

    it("ignores EXPO_PUBLIC_DEMO_MODE=true — the flag never gates auth in a release", () => {
      expect(resolveDemoMode({ hasCreds: true, forceFlag: true, isDev: false })).toEqual({
        demo: false,
        reason: "real",
      });
    });

    it("never falls back to demo when credentials are missing; flags it as a build bug", () => {
      const decision = resolveDemoMode({ hasCreds: false, forceFlag: false, isDev: false });
      expect(decision.demo).toBe(false);
      expect(decision.reason).toBe("release-missing-creds");
    });

    it("still refuses demo when both creds are missing and the flag is set", () => {
      expect(resolveDemoMode({ hasCreds: false, forceFlag: true, isDev: false })).toEqual({
        demo: false,
        reason: "release-missing-creds",
      });
    });
  });

  describe("dev builds (isDev = true)", () => {
    it("uses real auth when credentials are present and the flag is off", () => {
      expect(resolveDemoMode({ hasCreds: true, forceFlag: false, isDev: true })).toEqual({
        demo: false,
        reason: "real",
      });
    });

    it("honours EXPO_PUBLIC_DEMO_MODE=true even with credentials", () => {
      expect(resolveDemoMode({ hasCreds: true, forceFlag: true, isDev: true })).toEqual({
        demo: true,
        reason: "forced",
      });
    });

    it("falls back to demo when credentials are missing", () => {
      expect(resolveDemoMode({ hasCreds: false, forceFlag: false, isDev: true })).toEqual({
        demo: true,
        reason: "no-creds",
      });
    });
  });
});
