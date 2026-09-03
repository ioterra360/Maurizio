import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invarianti sulla configurazione NATIVA (app.json, eas.json, asset).
 * Sono input del fingerprint: un errore qui non si vede in Expo Go e costa
 * una build EAS da 20 minuti, o peggio un binario sugli store con l'icona
 * sbagliata. Vitest gira dalla root del repo (vitest.config.ts).
 */
const ROOT = process.cwd();

/** Legge l'IHDR di un PNG: larghezza, altezza, tipo di colore (6 = RGBA, 2 = RGB). */
function pngHeader(relative: string): { width: number; height: number; colorType: number } {
  const b = readFileSync(path.join(ROOT, relative));
  if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${relative} non è un PNG`);
  }
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

describe("icona di notifica Android", () => {
  it("è 96×96 con canale alpha, come chiede il plugin expo-notifications", () => {
    // withNotifications.d.ts:3-9 — "96x96 all-white png with transparency".
    // Android usa SOLO l'alpha: senza trasparenza l'icona è un quadrato pieno.
    const h = pngHeader("assets/notification-icon.png");
    expect(h.width).toBe(96);
    expect(h.height).toBe(96);
    expect(h.colorType).toBe(6);
  });
});
