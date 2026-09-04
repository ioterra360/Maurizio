import { describe, expect, it } from "vitest";

import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_RECONCILE_GRACE_MS,
  checkPhotoBytes,
  makeSignedUrlCache,
  orphanPhotoPaths,
  photoPathFor,
  resizeTarget,
} from "./photo-utils";

describe("photoPathFor", () => {
  it("compone <user_id>/<memory_id>.jpg, senza prefisso bucket", () => {
    expect(photoPathFor("u-1", "m-2")).toBe("u-1/m-2.jpg");
  });
});

describe("resizeTarget", () => {
  it("non ingrandisce mai: entro il limite → null", () => {
    expect(resizeTarget(PHOTO_MAX_EDGE, 1200)).toBeNull();
    expect(resizeTarget(800, 600)).toBeNull();
  });

  it("orizzontale: vincola SOLO la larghezza, l'altezza la calcola il nativo", () => {
    expect(resizeTarget(4000, 3000)).toEqual({ width: PHOTO_MAX_EDGE });
  });

  it("verticale: vincola SOLO l'altezza", () => {
    expect(resizeTarget(3000, 4000)).toEqual({ height: PHOTO_MAX_EDGE });
  });

  it("quadrata: larghezza", () => {
    expect(resizeTarget(2000, 2000)).toEqual({ width: PHOTO_MAX_EDGE });
  });

  it("dimensioni ignote (0, come può darle il picker) → null", () => {
    expect(resizeTarget(0, 0)).toBeNull();
  });
});

/** Un finto JPEG: i primi tre byte sono FF D8 FF. */
const jpeg = (size = 16): ArrayBuffer => {
  const b = new Uint8Array(size);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  return b.buffer;
};

describe("checkPhotoBytes", () => {
  it("accetta un JPEG sotto il tetto", () => {
    expect(checkPhotoBytes(jpeg())).toBe("ok");
  });

  it("rifiuta il vuoto", () => {
    expect(checkPhotoBytes(new ArrayBuffer(0))).toBe("empty");
  });

  it("rifiuta ciò che non inizia con FF D8 FF (PNG, HEIC…)", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).buffer;
    expect(checkPhotoBytes(png)).toBe("not_jpeg");
  });

  it("rifiuta un file di due byte", () => {
    expect(checkPhotoBytes(new Uint8Array([0xff, 0xd8]).buffer)).toBe("not_jpeg");
  });

  it("rifiuta oltre il tetto del bucket", () => {
    expect(checkPhotoBytes(jpeg(PHOTO_MAX_BYTES + 1))).toBe("too_large");
  });
});

describe("orphanPhotoPaths", () => {
  const NOW = Date.parse("2026-09-03T12:00:00.000Z");
  const OLD = "2026-09-01T10:00:00.000Z";

  it("segnala gli oggetti senza riga, con il path completo", () => {
    const orphans = orphanPhotoPaths(
      "u1",
      [
        { name: "m1.jpg", createdAt: OLD },
        { name: "m2.jpg", createdAt: OLD },
      ],
      ["u1/m1.jpg"],
      NOW,
    );
    expect(orphans).toEqual(["u1/m2.jpg"]);
  });

  it("lascia stare gli oggetti appena caricati: potrebbe essere un upload in corso", () => {
    const fresh = new Date(NOW - PHOTO_RECONCILE_GRACE_MS + 1000).toISOString();
    expect(orphanPhotoPaths("u1", [{ name: "m9.jpg", createdAt: fresh }], [], NOW)).toEqual([]);
  });

  it("senza data di creazione l'oggetto è considerato vecchio", () => {
    expect(orphanPhotoPaths("u1", [{ name: "m3.jpg", createdAt: null }], [], NOW)).toEqual([
      "u1/m3.jpg",
    ]);
  });

  it("una riga nel cestino tiene viva la sua foto (referenced include il cestino)", () => {
    expect(
      orphanPhotoPaths("u1", [{ name: "m4.jpg", createdAt: OLD }], ["u1/m4.jpg"], NOW),
    ).toEqual([]);
  });

  it("nessun oggetto → nessun orfano", () => {
    expect(orphanPhotoPaths("u1", [], ["u1/m1.jpg"], NOW)).toEqual([]);
  });
});

describe("makeSignedUrlCache", () => {
  const H = 60 * 60 * 1000;
  const M5 = 5 * 60 * 1000;

  it("restituisce l'URL finché è lontano dalla scadenza", () => {
    let now = 0;
    const cache = makeSignedUrlCache({ ttlMs: H, refreshMarginMs: M5, now: () => now });
    cache.set("u/m.jpg", "https://x/1");
    now = H - M5 - 1;
    expect(cache.get("u/m.jpg")).toBe("https://x/1");
  });

  it("scade con il margine, PRIMA della scadenza vera", () => {
    let now = 0;
    const cache = makeSignedUrlCache({ ttlMs: H, refreshMarginMs: M5, now: () => now });
    cache.set("u/m.jpg", "https://x/1");
    now = H - M5;
    expect(cache.get("u/m.jpg")).toBeNull();
  });

  it("il margine di default è 5 minuti", () => {
    let now = 0;
    const cache = makeSignedUrlCache({ ttlMs: H, now: () => now });
    cache.set("u/m.jpg", "https://x/1");
    now = H - M5 - 1;
    expect(cache.get("u/m.jpg")).toBe("https://x/1");
    now = H - M5;
    expect(cache.get("u/m.jpg")).toBeNull();
  });

  it("un TTL corto ha un margine di metà TTL, non 5 minuti", () => {
    let now = 0;
    const cache = makeSignedUrlCache({ ttlMs: 60_000, now: () => now });
    cache.set("p", "u");
    now = 29_999;
    expect(cache.get("p")).toBe("u");
    now = 30_000;
    expect(cache.get("p")).toBeNull();
  });

  it("path sconosciuto → null; invalidate e clear svuotano", () => {
    const cache = makeSignedUrlCache({ ttlMs: H, now: () => 0 });
    expect(cache.get("nope")).toBeNull();
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate("a");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("2");
    cache.clear();
    expect(cache.get("b")).toBeNull();
  });
});
