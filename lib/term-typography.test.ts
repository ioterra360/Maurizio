import { describe, expect, it } from "vitest";

import { termFontSize, termLineHeight, termLines } from "./term-typography";

// Content box of a 360 dp phone in the review screens: 360 - 2*24 - 2*8.
const BOX = 296;

describe("termFontSize — width-aware size for the review term", () => {
  it("keeps short words at the layer maximum", () => {
    expect(termFontSize("casa", BOX, 84)).toBe(84);
    expect(termFontSize("時間", BOX, 84)).toBe(84);
  });

  it("shrinks a 7-letter word so it fits on one line (the tester's six-letter clip)", () => {
    const size = termFontSize("sendero", BOX, 84);
    expect(size).toBeLessThan(84);
    expect(size).toBeGreaterThanOrEqual(70);
  });

  it("scales continuously with length: longer words get smaller", () => {
    const a = termFontSize("sendero", BOX, 84);
    const b = termFontSize("biblioteca", BOX, 84);
    const c = termFontSize("escabullirse", BOX, 84);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThanOrEqual(40);
  });

  it("treats CJK characters as full-width", () => {
    expect(termFontSize("難しい", BOX, 84)).toBe(84);
    expect(termFontSize("国際連合安全", BOX, 84)).toBeLessThan(60);
  });

  it("lets multi-word terms wrap to two lines, capped at 75% of the layer maximum", () => {
    // "Habeas corpus": each word fits a line, two lines at 84 would eat 184 dp
    // of a non-scrolling column, so the ceiling for multi-word terms is 63.
    expect(termFontSize("Habeas corpus", BOX, 84)).toBe(63);
    expect(termFontSize("a priori", BOX, 84)).toBe(63);
    // A long two-word term still shrinks so the longest word fits a line.
    expect(termFontSize("Responsabilità extracontrattuale", BOX, 84)).toBeLessThan(40);
  });

  it("never goes below the readable floor", () => {
    expect(termFontSize("pneumonoultramicroscopicsilicovolcanoconiosis", BOX, 84)).toBe(28);
  });

  it("respects a smaller layer maximum", () => {
    expect(termFontSize("casa", BOX, 56)).toBe(56);
  });

  it("derives a line height with breathing room for ascenders", () => {
    expect(termLineHeight(84)).toBe(92);
    expect(termLineHeight(28)).toBe(31);
  });
});

describe("termLines — how many lines the term may take", () => {
  it("gives a single word two lines (a mid-word wrap beats clipping)", () => {
    expect(termLines("sendero", BOX, termFontSize("sendero", BOX, 84))).toBe(2);
  });

  it("keeps a short two-word term on two lines at its size", () => {
    expect(termLines("Habeas corpus", BOX, termFontSize("Habeas corpus", BOX, 84))).toBe(2);
  });

  it("gives a long phrase at the floor enough lines to show it (never more than 4)", () => {
    const phrase = "Il principio di non contraddizione nella logica classica";
    const size = termFontSize(phrase, BOX, 84);
    expect(size).toBe(28);
    const lines = termLines(phrase, BOX, size);
    expect(lines).toBeGreaterThanOrEqual(3);
    expect(lines).toBeLessThanOrEqual(4);
    expect(termLines("a ".repeat(120), BOX, 28)).toBe(4);
  });
});
