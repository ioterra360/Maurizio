import { describe, expect, it } from "vitest";

import {
  CUSTOM_FOLDER_KIND,
  CUSTOM_ITEM_TYPES,
  FOLDER_KINDS,
  FOLDER_TEMPLATES,
  TEMPLATE_KINDS,
} from "./constants";
import {
  folderInputFromChoice,
  getTemplate,
  isTemplateKind,
  itemTypesForKind,
  nextFolderPriority,
  validateFolderName,
} from "./folder-templates";

describe("constants", () => {
  it("keeps the four template slugs unchanged and adds custom", () => {
    expect(TEMPLATE_KINDS).toEqual(["jp", "medicine", "es", "law"]);
    expect(FOLDER_KINDS).toEqual(["jp", "medicine", "es", "law", "custom"]);
    expect(FOLDER_TEMPLATES.map((t) => t.kind)).toEqual(TEMPLATE_KINDS);
  });

  it("localizes template names and chips in Italian", () => {
    expect(FOLDER_TEMPLATES.map((t) => t.name)).toEqual([
      "Giapponese",
      "Medicina",
      "Spagnolo",
      "Diritto",
    ]);
    expect(getTemplate("jp").itemTypes.map((i) => i.label)).toEqual([
      "Parola",
      "Kanji",
      "Grammatica",
      "Frase",
    ]);
  });
});

describe("getTemplate / isTemplateKind / itemTypesForKind", () => {
  it("looks a template up by kind", () => {
    expect(getTemplate("law").name).toBe("Diritto");
    expect(getTemplate("medicine").itemTypes.map((i) => i.value)).toEqual([
      "term",
      "concept",
      "drug",
      "fact",
    ]);
  });

  it("recognizes template kinds only", () => {
    expect(isTemplateKind("jp")).toBe(true);
    expect(isTemplateKind("custom")).toBe(false);
    expect(isTemplateKind(null)).toBe(false);
    expect(isTemplateKind("")).toBe(false);
  });

  it("falls back to generic chips for custom folders", () => {
    expect(itemTypesForKind("es")).toBe(getTemplate("es").itemTypes);
    expect(itemTypesForKind(CUSTOM_FOLDER_KIND)).toBe(CUSTOM_ITEM_TYPES);
  });
});

describe("validateFolderName", () => {
  it("trims and collapses whitespace", () => {
    expect(validateFolderName("  Storia   dell'arte  ")).toEqual({
      ok: true,
      name: "Storia dell'arte",
    });
  });

  it("rejects empty / whitespace-only names", () => {
    expect(validateFolderName("")).toMatchObject({ ok: false, reason: "empty" });
    expect(validateFolderName("   \n ")).toMatchObject({ ok: false, reason: "empty" });
  });

  it("accepts exactly 40 chars and rejects 41", () => {
    expect(validateFolderName("a".repeat(40))).toMatchObject({ ok: true });
    expect(validateFolderName("a".repeat(41))).toMatchObject({ ok: false, reason: "too-long" });
  });

  it("measures length after trimming", () => {
    expect(validateFolderName("  " + "a".repeat(40) + "  ")).toMatchObject({ ok: true });
  });
});

describe("nextFolderPriority", () => {
  it("is 1 for a brand-new user", () => {
    expect(nextFolderPriority([])).toBe(1);
  });

  it("is max+1 regardless of order or gaps", () => {
    expect(nextFolderPriority([{ priority: 3 }, { priority: 1 }])).toBe(4);
    expect(nextFolderPriority([{ priority: 1 }])).toBe(2);
  });
});

describe("folderInputFromChoice", () => {
  it("expands a template into kind + Italian name + chips", () => {
    expect(folderInputFromChoice({ type: "template", kind: "es" })).toEqual({
      kind: "es",
      name: "Spagnolo",
      itemTypes: getTemplate("es").itemTypes,
    });
  });

  it("builds a custom folder with the cleaned name and generic chips", () => {
    expect(folderInputFromChoice({ type: "custom", name: "  Chimica " })).toEqual({
      kind: "custom",
      name: "Chimica",
      itemTypes: CUSTOM_ITEM_TYPES,
    });
  });

  it("throws on an invalid custom name", () => {
    expect(() => folderInputFromChoice({ type: "custom", name: " " })).toThrow();
  });
});
