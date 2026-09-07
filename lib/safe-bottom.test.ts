import { describe, expect, it } from "vitest";

import { safeBottom } from "./safe-bottom";

describe("safeBottom", () => {
  it("senza barra di sistema vale il minimo del layout", () => {
    expect(safeBottom(0, 32)).toBe(32);
    expect(safeBottom(0, 24)).toBe(24);
  });

  it("con i tre tasti Android (48) il bottone sale sopra la barra, con un respiro", () => {
    expect(safeBottom(48, 32)).toBe(60);
    expect(safeBottom(48, 24)).toBe(60);
  });

  it("con l'indicatore Home di iPhone (34) idem", () => {
    expect(safeBottom(34, 32)).toBe(46);
    expect(safeBottom(34, 28)).toBe(46);
  });

  it("un minimo gia' generoso non si riduce mai", () => {
    expect(safeBottom(48, 160)).toBe(160);
  });

  it("un inset assurdo non rompe il layout", () => {
    expect(safeBottom(Number.NaN, 32)).toBe(32);
    expect(safeBottom(-10, 32)).toBe(32);
  });

  it("il respiro e' regolabile", () => {
    expect(safeBottom(48, 32, 0)).toBe(48);
    expect(safeBottom(48, 32, 20)).toBe(68);
  });
});
