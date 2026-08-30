import { describe, expect, it as test, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  I18nManager: { getConstants: () => ({ localeIdentifier: "it_IT" }) },
  NativeModules: {},
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { interpolate, localeFromTag, t, tp, useLocaleStore } from "./index";

describe("catalogs", () => {
  test("every catalog has exactly the keys of it", () => {
    for (const cat of [en, fr, es]) expect(Object.keys(cat).sort()).toEqual(Object.keys(it).sort());
  });
  test("placeholders match the Italian source in every catalog", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const cat of [en, fr, es] as Record<string, string>[]) {
      for (const [k, v] of Object.entries(it)) expect(ph(cat[k] ?? ""), k).toEqual(ph(v));
    }
  });
  test("plural keys come in _one/_other pairs", () => {
    for (const k of Object.keys(it)) {
      if (k.endsWith("_one")) expect(it).toHaveProperty(k.replace(/_one$/, "_other"));
      if (k.endsWith("_other")) expect(it).toHaveProperty(k.replace(/_other$/, "_one"));
    }
  });
  test("no empty strings", () => {
    for (const [k, v] of Object.entries({ ...it, ...en, ...fr, ...es })) expect(v.trim(), k).not.toBe("");
  });
});

describe("localeFromTag", () => {
  test("maps Italian tags to it and everything else to en", () => {
    expect(localeFromTag("it-IT")).toBe("it");
    expect(localeFromTag("it_CH")).toBe("it");
    expect(localeFromTag("en-US")).toBe("en");
    expect(localeFromTag("fr-FR")).toBe("fr");
    expect(localeFromTag("es_MX")).toBe("es");
    expect(localeFromTag("de-DE")).toBe("en");
    expect(localeFromTag(undefined)).toBe("en");
  });
});

describe("t / tp", () => {
  test("interpolates {vars} and leaves unknown placeholders", () => {
    expect(interpolate("Ciao {name}, {n} ricordi", { name: "Angelo", n: 3 })).toBe("Ciao Angelo, 3 ricordi");
    expect(interpolate("{missing}", {})).toBe("{missing}");
  });
  test("follows the store locale and falls back to Italian for unknown keys", () => {
    useLocaleStore.setState({ locale: "en" });
    expect(t("common.save")).toBe("Save");
    useLocaleStore.setState({ locale: "it" });
    expect(t("common.save")).toBe("Salva");
    // @ts-expect-error — unknown key on purpose
    expect(t("nope.missing")).toBe("nope.missing");
  });
  test("tp picks _one / _other", () => {
    const base = "x.items" as never;
    const cat = it as Record<string, string>;
    cat["x.items_one"] = "{count} ricordo";
    cat["x.items_other"] = "{count} ricordi";
    (en as Record<string, string>)["x.items_one"] = "{count} memory";
    (en as Record<string, string>)["x.items_other"] = "{count} memories";
    useLocaleStore.setState({ locale: "it" });
    expect(tp(base, 1)).toBe("1 ricordo");
    expect(tp(base, 4)).toBe("4 ricordi");
    delete cat["x.items_one"]; delete cat["x.items_other"];
    delete (en as Record<string, string>)["x.items_one"]; delete (en as Record<string, string>)["x.items_other"];
  });
});

describe("tp — CLDR plural category for zero", () => {
  // NB: "it" qui è il catalogo italiano importato sopra, non vitest.it.
  test("uses the singular form for 0 in French, plural elsewhere", async () => {
    const { tp } = await import("./index");
    expect(tp("accountDeletion.memoryCount", 0, undefined, "fr")).toBe("0 souvenir");
    expect(tp("accountDeletion.memoryCount", 0, undefined, "it")).toBe("0 ricordi");
    expect(tp("accountDeletion.memoryCount", 0, undefined, "en")).toBe("0 memories");
    expect(tp("accountDeletion.memoryCount", 0, undefined, "es")).toBe("0 recuerdos");
  });
});
