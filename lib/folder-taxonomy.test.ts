import { describe, expect, it } from "vitest";
import {
  LEGACY_KIND_TO_TEMPLATE,
  TAXONOMY,
  categoryById,
  filterSubcategories,
  itemTypesFor,
  legacyKindFor,
  subById,
  templateHasReading,
} from "./folder-taxonomy";

describe("TAXONOMY — la struttura di Maurizio", () => {
  it("ha esattamente le quattro macrocategorie, senza Esami", () => {
    expect(TAXONOMY.map((c) => c.id)).toEqual(["lingue", "materie", "lavoro", "interessi"]);
  });

  it("ha il numero di sottocategorie della lista di Maurizio", () => {
    const byId = Object.fromEntries(TAXONOMY.map((c) => [c.id, c.subcategories.length]));
    expect(byId).toEqual({ lingue: 11, materie: 11, lavoro: 10, interessi: 12 });
  });

  it("gli id delle sottocategorie sono globalmente unici", () => {
    const all = TAXONOMY.flatMap((c) => c.subcategories.map((s) => s.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it("ogni sottocategoria ha un nome localizzato e un'emoji", () => {
    for (const c of TAXONOMY) {
      for (const s of c.subcategories) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.emoji.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("lookup", () => {
  it("trova categorie e sottocategorie per id", () => {
    expect(categoryById("lingue")?.id).toBe("lingue");
    expect(categoryById("esami")).toBeNull();
    expect(subById("ja")?.emoji).toBe("🇯🇵");
    expect(subById("vino")?.emoji).toBe("🍷");
    expect(subById(null)).toBeNull();
  });
});

describe("itemTypesFor", () => {
  it("le lingue hanno le chip da lingua, il giapponese anche i kanji", () => {
    expect(itemTypesFor("lingue", "es").map((x) => x.value)).toEqual([
      "word", "verb", "grammar", "phrase",
    ]);
    expect(itemTypesFor("lingue", "ja").map((x) => x.value)).toContain("kanji");
  });

  it("medicina e diritto conservano le chip specifiche dei vecchi template", () => {
    expect(itemTypesFor("materie", "medicina").map((x) => x.value)).toContain("drug");
    expect(itemTypesFor("materie", "diritto").map((x) => x.value)).toContain("doctrine");
  });

  it("tutto il resto usa le chip generiche", () => {
    expect(itemTypesFor("interessi", "vino").map((x) => x.value)).toEqual([
      "term", "concept", "fact", "phrase",
    ]);
    expect(itemTypesFor("custom", null).length).toBeGreaterThan(0);
  });
});

describe("compatibilità legacy", () => {
  it("i quattro kind storici mappano su categoria+template+emoji", () => {
    expect(LEGACY_KIND_TO_TEMPLATE.jp).toEqual({ category: "lingue", templateId: "ja", emoji: "🇯🇵" });
    expect(LEGACY_KIND_TO_TEMPLATE.law.templateId).toBe("diritto");
  });

  it("legacyKindFor è l'inverso per i template storici, custom per il resto", () => {
    expect(legacyKindFor("ja")).toBe("jp");
    expect(legacyKindFor("medicina")).toBe("medicine");
    expect(legacyKindFor("vino")).toBe("custom");
    expect(legacyKindFor(null)).toBe("custom");
  });

  it("la lettura c'è per giapponese, cinese e coreano e basta", () => {
    expect(templateHasReading("ja")).toBe(true);
    expect(templateHasReading("zh")).toBe(true);
    expect(templateHasReading("es")).toBe(false);
    expect(templateHasReading(null)).toBe(false);
  });
});

describe("filterSubcategories — la ricerca del selettore", () => {
  const lingue = TAXONOMY[0].subcategories;

  it("filtra per prefisso ignorando maiuscole e accenti", () => {
    expect(filterSubcategories(lingue, "giap").map((s) => s.id)).toEqual(["ja"]);
    expect(filterSubcategories(lingue, "SPA").map((s) => s.id)).toEqual(["es"]);
  });

  it("query vuota = tutte", () => {
    expect(filterSubcategories(lingue, "  ").length).toBe(lingue.length);
  });

  it("nessun match = lista vuota", () => {
    expect(filterSubcategories(lingue, "klingon").length).toBe(0);
  });
});
