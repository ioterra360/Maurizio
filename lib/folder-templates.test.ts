import { describe, expect, it } from "vitest";

import {
  folderInputFromCustomName,
  folderInputFromSubcategory,
  nextFolderPriority,
  validateFolderName,
} from "./folder-templates";
import { TAXONOMY } from "./folder-taxonomy";

describe("validateFolderName", () => {
  it("trims and collapses whitespace", () => {
    expect(validateFolderName("  Storia   dell'arte  ")).toEqual({
      ok: true,
      name: "Storia dell'arte",
    });
  });

  it("rejects empty and whitespace-only names", () => {
    expect(validateFolderName("   ").ok).toBe(false);
  });

  it("rejects names over 40 chars", () => {
    const v = validateFolderName("x".repeat(41));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("too-long");
  });
});

describe("nextFolderPriority", () => {
  it("starts at 1 and appends after the max", () => {
    expect(nextFolderPriority([])).toBe(1);
    expect(nextFolderPriority([{ priority: 1 }, { priority: 3 }])).toBe(4);
  });
});

describe("folderInputFromSubcategory", () => {
  it("porta nome, categoria, template ed emoji della sottocategoria", () => {
    const vino = TAXONOMY.find((c) => c.id === "interessi")!.subcategories.find(
      (s) => s.id === "vino",
    )!;
    const input = folderInputFromSubcategory("interessi", vino);
    expect(input).toMatchObject({ category: "interessi", templateId: "vino", emoji: "🍷" });
    expect(input.name.length).toBeGreaterThan(0);
  });
});

describe("folderInputFromCustomName", () => {
  it("crea una cartella personalizzata col nome validato", () => {
    const input = folderInputFromCustomName("  Vela  d'altura ");
    expect(input).toEqual({
      name: "Vela d'altura",
      category: "custom",
      templateId: null,
      emoji: "📁",
    });
  });

  it("una 'Altra lingua…' resta nella categoria lingue", () => {
    const input = folderInputFromCustomName("Swahili", "lingue", "🌐");
    expect(input.category).toBe("lingue");
    expect(input.templateId).toBeNull();
  });

  it("throws sull'input invalido (ultima linea di difesa)", () => {
    expect(() => folderInputFromCustomName("   ")).toThrow();
  });
});
