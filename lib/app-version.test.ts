import { describe, expect, it } from "vitest";

import { formatAppVersion, memberSinceLabel, resolveAppVersion } from "./app-version";

describe("resolveAppVersion", () => {
  it("prefers the native build number over the config one", () => {
    expect(resolveAppVersion({ version: "0.1.0", nativeBuild: "12", configBuild: "3" })).toEqual({
      version: "0.1.0",
      build: "12",
    });
  });

  it("accepts a numeric Android versionCode", () => {
    expect(resolveAppVersion({ version: "0.1.0", nativeBuild: 7 })).toEqual({
      version: "0.1.0",
      build: "7",
    });
  });

  it("falls back to the config build when the native one is missing (Expo Go)", () => {
    expect(resolveAppVersion({ version: "0.1.0", nativeBuild: null, configBuild: "3" }).build).toBe(
      "3",
    );
  });

  it("treats empty strings as unknown", () => {
    expect(resolveAppVersion({ version: "  ", nativeBuild: "", configBuild: " " })).toEqual({
      version: "—",
      build: null,
    });
  });
});

describe("formatAppVersion", () => {
  it("renders version and build", () => {
    expect(formatAppVersion({ version: "0.1.0", nativeBuild: "12" })).toBe("0.1.0 (12)");
  });

  it("omits the parenthesis without a build", () => {
    expect(formatAppVersion({ version: "0.1.0" })).toBe("0.1.0");
  });
});

describe("memberSinceLabel", () => {
  it("formats an ISO timestamp as an Italian month + year", () => {
    // Mid-month noon so every time zone lands on the same calendar month.
    expect(memberSinceLabel("2026-08-15T12:00:00Z")).toBe("da agosto 2026");
    expect(memberSinceLabel("2026-01-15T12:00:00Z")).toBe("da gennaio 2026");
    expect(memberSinceLabel("2025-12-15T12:00:00Z")).toBe("da dicembre 2025");
  });

  it("accepts the Postgres timestamptz text form", () => {
    expect(memberSinceLabel("2026-03-15 10:20:30.123456+00")).toBe("da marzo 2026");
  });

  it("returns null for missing or garbage input", () => {
    expect(memberSinceLabel(null)).toBeNull();
    expect(memberSinceLabel(undefined)).toBeNull();
    expect(memberSinceLabel("")).toBeNull();
    expect(memberSinceLabel("not a date")).toBeNull();
  });
});
