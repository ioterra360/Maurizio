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
  it("una parola singola sta su UNA riga: mai 'embarg / o'", () => {
    // Maurizio 2026-09-01: fino a 12 lettere la parola non si spezza.
    // Prima il modello sottostimava le parole con m/w (0.58em assunto contro
    // 0.913em reale della m in Inter Bold) e concedeva sempre 2 righe, così
    // React Native considerava "embarg/o" un fit valido.
    for (const w of ["sendero", "embargo", "commercio", "memoria", "biblioteca"]) {
      expect(termLines(w, BOX, termFontSize(w, BOX, 84))).toBe(1);
    }
  });

  it("la regola dei 12 caratteri regge sul caso peggiore, su ogni schermo e layer", () => {
    // Scatole reali delle schermate di ripasso: 320/360/393/412 dp − 2×24 − 2×8.
    const boxes = [256, 296, 329, 348];
    // 12 × 'm' è la parola più larga possibile (0.913 em a lettera);
    // escabullirse e wwww… coprono i casi reali e patologici.
    const worst = ["mmmmmmmmmmmm", "wwwwwwwwwwww", "escabullirse", "protuberanza"];
    for (const box of boxes) {
      for (const max of [84, 80, 72]) {
        for (const w of worst) {
          const size = termFontSize(w, box, max);
          expect(termLines(w, box, size)).toBe(1);
          expect(size).toBeGreaterThanOrEqual(24);
        }
      }
    }
  });

  it("una parola impossibile (oltre ogni floor) può ancora andare a capo", () => {
    const w = "pneumonoultramicroscopicsilicovolcanoconiosis";
    const size = termFontSize(w, BOX, 84);
    expect(size).toBe(28);
    expect(termLines(w, BOX, size)).toBeGreaterThanOrEqual(2);
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
