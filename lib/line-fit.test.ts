import { describe, expect, it } from "vitest";

import { lineFontSize } from "./term-typography";

// Content box of the ItemRow text column on a 360 dp phone (~250 px).
const BOX = 250;

describe("lineFontSize — one-line fit with a readable floor", () => {
  it("keeps short text at the requested size", () => {
    expect(lineFontSize("casa", BOX, 15, 12)).toBe(15);
  });

  it("shrinks long text so it fits a narrow line instead of clipping", () => {
    // 160 px ≈ the text column when badges and the state chip eat the row.
    const size = lineFontSize("elettroencefalogramma", 160, 15, 12);
    expect(size).toBeLessThan(15);
    expect(size).toBeGreaterThanOrEqual(12);
  });

  it("stops at the floor for very long text (ellipsis takes over)", () => {
    expect(lineFontSize("pneumonoultramicroscopicsilicovolcanoconiosis!!", BOX, 15, 12)).toBe(12);
  });

  it("respects CJK full-width glyphs", () => {
    expect(lineFontSize("難しい", BOX, 17, 12)).toBe(17);
    expect(lineFontSize("国際連合安全保障理事会常任理事国", BOX, 17, 12)).toBeLessThan(17);
  });

  it("never returns above max or below floor", () => {
    expect(lineFontSize("", BOX, 15, 12)).toBe(15);
    expect(lineFontSize("x".repeat(500), BOX, 15, 12)).toBe(12);
  });
});

describe("termFontSize floor override (memory sheet title)", () => {
  it("accepts a custom floor below the review default of 28", async () => {
    const { termFontSize } = await import("./term-typography");
    // Parola patologica (non entra su una riga nemmeno al floor): dal
    // 2026-09-02 si dimensiona per riempire due righe invece di schiacciarsi
    // al floor — il floor override resta il MINIMO garantito, non il valore.
    const size = termFontSize("pneumonoultramicroscopicsilicovolcanoconiosis", 316, 42, 24);
    expect(size).toBeGreaterThanOrEqual(24);
    expect(size).toBeLessThanOrEqual(42);
  });
});
