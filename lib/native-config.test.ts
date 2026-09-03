import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * Invarianti sulla configurazione NATIVA (app.json, eas.json, asset).
 * Sono input del fingerprint: un errore qui non si vede in Expo Go e costa
 * una build EAS da 20 minuti, o peggio un binario sugli store con l'icona
 * sbagliata. Vitest gira dalla root del repo (vitest.config.ts).
 */
const ROOT = process.cwd();

/** Legge un file del repo verificandone la firma PNG. */
function readPng(relative: string): Buffer {
  const b = readFileSync(path.join(ROOT, relative));
  if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${relative} non è un PNG`);
  }
  return b;
}

/** Legge l'IHDR di un PNG: larghezza, altezza, tipo di colore (6 = RGBA, 2 = RGB). */
function pngHeader(relative: string): { width: number; height: number; colorType: number } {
  const b = readPng(relative);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

/** Predittore Paeth del filtro PNG di tipo 4 (RFC 2083 § 6.6). */
function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const dLeft = Math.abs(p - left);
  const dUp = Math.abs(p - up);
  const dUpLeft = Math.abs(p - upLeft);
  if (dLeft <= dUp && dLeft <= dUpLeft) return left;
  return dUp <= dUpLeft ? up : upLeft;
}

/**
 * Decodifica un PNG RGBA a 8 bit non interlacciato — concatena gli IDAT, li
 * decomprime e disfa i filtri per riga (0-4) — e conta i pixel: quelli
 * completamente trasparenti e quelli pienamente opachi che NON sono bianco puro.
 *
 * Serve perché `colorType === 6` dimostra solo che il canale alpha ESISTE, non
 * che sia USATO: un 96×96 bianco tutto opaco passerebbe il controllo sull'IHDR
 * ed è esattamente il quadrato pieno che Android disegnerebbe nella status bar.
 */
function alphaStats(relative: string): { fullyTransparent: number; opaqueNonWhite: number } {
  const b = readPng(relative);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const bitDepth = b[24];
  const colorType = b[25];
  const interlace = b[28];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `${relative}: atteso RGBA a 8 bit non interlacciato, trovato depth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
    );
  }

  // Gli IDAT possono essere più di uno: vanno concatenati prima dell'inflate.
  const idat: Buffer[] = [];
  for (let off = 8; off + 8 <= b.length; ) {
    const length = b.readUInt32BE(off);
    const type = b.subarray(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") idat.push(b.subarray(off + 8, off + 8 + length));
    off += 12 + length; // lunghezza (4) + tipo (4) + dati + CRC (4)
    if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));

  const bpp = 4; // RGBA a 8 bit
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) {
    throw new Error(`${relative}: dati IDAT troncati`);
  }
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? px[dst + x - bpp] : 0;
      const up = y > 0 ? px[dst - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? px[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      let recon: number;
      switch (filter) {
        case 0: recon = v; break;
        case 1: recon = v + left; break;
        case 2: recon = v + up; break;
        case 3: recon = v + ((left + up) >> 1); break;
        case 4: recon = v + paeth(left, up, upLeft); break;
        default: throw new Error(`${relative}: filtro di riga PNG sconosciuto (${filter}) alla riga ${y}`);
      }
      px[dst + x] = recon & 0xff;
    }
  }

  let fullyTransparent = 0;
  let opaqueNonWhite = 0;
  for (let i = 0; i < px.length; i += bpp) {
    const alpha = px[i + 3];
    if (alpha === 0) {
      fullyTransparent += 1;
    } else if (alpha === 255 && (px[i] !== 255 || px[i + 1] !== 255 || px[i + 2] !== 255)) {
      opaqueNonWhite += 1;
    }
  }
  return { fullyTransparent, opaqueNonWhite };
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

  it("usa davvero l'alpha ed è bianca: sfondo trasparente, nessun pixel opaco colorato", () => {
    // Il colorType da solo non basta: un quadrato bianco pieno con canale alpha
    // tutto opaco lo supererebbe. Qui si guarda il contenuto: la maggior parte
    // del quadrato deve essere completamente trasparente (oggi il 76,8%) e ogni
    // pixel opaco deve essere bianco puro, perché Android tinge la sagoma col
    // `color` del plugin e qualunque area opaca in più diventa fondo pieno.
    const { width, height } = pngHeader("assets/notification-icon.png");
    const stats = alphaStats("assets/notification-icon.png");
    expect(stats.fullyTransparent).toBeGreaterThan((width * height) / 2);
    expect(stats.opaqueNonWhite).toBe(0);
  });
});

type PluginEntry = string | [string, Record<string, unknown>];
type AppJson = {
  expo: {
    icon: string;
    userInterfaceStyle: string;
    android: {
      adaptiveIcon: { foregroundImage: string; backgroundColor: string };
      permissions: string[];
      blockedPermissions?: string[];
    };
    plugins: PluginEntry[];
  };
};

const appJson = JSON.parse(readFileSync(path.join(ROOT, "app.json"), "utf8")) as AppJson;

/** Le opzioni della voce `[nome, opzioni]` in expo.plugins, o undefined se manca. */
function pluginProps(name: string): Record<string, unknown> | undefined {
  for (const entry of appJson.expo.plugins) {
    if (Array.isArray(entry) && entry[0] === name) return entry[1];
  }
  return undefined;
}

const sameBytes = (a: string, b: string) =>
  readFileSync(path.join(ROOT, a)).equals(readFileSync(path.join(ROOT, b)));

describe("app.json — build 3", () => {
  it("segue il tema del telefono", () => {
    // theme/theme-store.ts risolve "system" con Appearance: finché qui c'era
    // "light" l'OS consegnava sempre chiaro.
    expect(appJson.expo.userInterfaceStyle).toBe("automatic");
  });

  it("dichiara expo-notifications con l'icona bianca e la tinta leggibile su entrambe le tendine", () => {
    const props = pluginProps("expo-notifications");
    expect(props?.icon).toBe("./assets/notification-icon.png");
    // Accent SCURO: il plugin scrive notification_icon_color in un unico
    // colors.xml (niente values-night), quindi il valore deve reggere sia sulla
    // tendina chiara sia su quella scura. #1A2C4F su scuro sta a ~1.2:1.
    expect(props?.color).toBe("#3B6BF5");
    // mode resta al default 'development': Xcode lo promuove in archive, e
    // 'production' nel profilo development è la combinazione che rifiuta.
    expect(props?.mode).toBeUndefined();
  });

  it("dichiara expo-image-picker con le frasi italiane e senza microfono", () => {
    const props = pluginProps("expo-image-picker");
    expect(props?.cameraPermission).toBe(
      "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
    );
    expect(props?.photosPermission).toBe("Memika legge le tue foto per allegarle ai ricordi.");
    expect(props?.microphonePermission).toBe(false);
  });

  it("permessi Android senza doppioni, con BILLING e con RECORD_AUDIO bloccato", () => {
    const perms = appJson.expo.android.permissions;
    expect(new Set(perms).size).toBe(perms.length);
    expect(perms).toContain("com.android.vending.BILLING");
    expect(perms).not.toContain("android.permission.RECORD_AUDIO");
    expect(appJson.expo.android.blockedPermissions).toContain("android.permission.RECORD_AUDIO");
  });

  it("monta l'icona v2 byte per byte, su sfondo rosa", () => {
    expect(appJson.expo.icon).toBe("./assets/icon.png");
    expect(appJson.expo.android.adaptiveIcon.foregroundImage).toBe("./assets/adaptive-icon.png");
    expect(sameBytes("assets/icon.png", "assets/brand/icon-v2/icon.png")).toBe(true);
    expect(sameBytes("assets/adaptive-icon.png", "assets/brand/icon-v2/adaptive-icon.png")).toBe(true);
    expect(appJson.expo.android.adaptiveIcon.backgroundColor).toBe("#F8D2C4");
    expect(pngHeader("assets/icon.png")).toEqual({ width: 1024, height: 1024, colorType: 6 });
  });

  it("gli asset per gli store sono la v2, e quello Apple è senza alpha", () => {
    // docs/store-assets/appstore-icon-1024.png si carica A MANO nella scheda di
    // App Store Connect: non passa da prebuild e Apple rifiuta il canale alpha.
    // Va quindi APPIATTITO dalla v2 (colorType 2 = RGB), non copiato grezzo.
    expect(
      sameBytes(
        "docs/store-assets/appstore-icon-1024.png",
        "assets/brand/icon-v2/appstore-icon-1024.png",
      ),
    ).toBe(true);
    expect(pngHeader("docs/store-assets/appstore-icon-1024.png")).toEqual({
      width: 1024,
      height: 1024,
      colorType: 2,
    });
    // Play accetta l'alpha: qui basta la copia byte per byte della v2.
    expect(sameBytes("docs/store-assets/play-icon-512.png", "assets/brand/icon-v2/play-icon-512.png")).toBe(true);
  });
});
