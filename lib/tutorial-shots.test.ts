import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SHOT_ASPECT, TUTORIAL_SHOTS, shotAssetName } from "./tutorial-shots";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "tutorial");
const LOCALES = ["it", "en", "fr", "es"] as const;
const SCHEMES = ["light", "dark"] as const;

describe("tutorial shots", () => {
  it("il nome del file segue schermata-lingua-tema.webp", () => {
    expect(shotAssetName("today", "it", "light")).toBe("today-it-light.webp");
    expect(shotAssetName("notifications", "es", "dark")).toBe("notifications-es-dark.webp");
    expect(SHOT_ASPECT).toBeCloseTo(0.45, 2);
  });

  it("ogni schermata esiste in tutte e quattro le lingue e in entrambi i temi", () => {
    for (const shot of TUTORIAL_SHOTS) {
      for (const locale of LOCALES) {
        for (const scheme of SCHEMES) {
          const file = resolve(ASSETS, shotAssetName(shot, locale, scheme));
          expect(existsSync(file), file).toBe(true);
        }
      }
    }
  });

  it("nessun file orfano e peso complessivo sotto i 4 MB (viaggia con l'OTA)", () => {
    const files = readdirSync(ASSETS).filter((f) => f.endsWith(".webp"));
    expect(files).toHaveLength(TUTORIAL_SHOTS.length * LOCALES.length * SCHEMES.length);
    const total = files.reduce((sum, f) => sum + statSync(resolve(ASSETS, f)).size, 0);
    expect(total).toBeLessThan(4 * 1024 * 1024);
  });

  it("la mappa delle require copre esattamente le stesse combinazioni", () => {
    // Si legge il sorgente come testo: una require .webp non si importa in vitest.
    const src = resolve(dirname(fileURLToPath(import.meta.url)), "tutorial-shot-sources.ts");
    expect(existsSync(src)).toBe(true);
    const text = require("node:fs").readFileSync(src, "utf8") as string;
    for (const shot of TUTORIAL_SHOTS) {
      for (const locale of LOCALES) {
        for (const scheme of SCHEMES) {
          expect(text, shotAssetName(shot, locale, scheme)).toContain(
            `require("../assets/tutorial/${shotAssetName(shot, locale, scheme)}")`,
          );
        }
      }
    }
  });
});
