/**
 * Helper PURI per le foto sui ricordi: nessun I/O, nessun import nativo —
 * testati con vitest (lib/photo-utils.test.ts). Chi tocca picker, Storage e
 * DB è lib/photos.ts; i componenti importano da qui solo tipi e costanti.
 */

export const PHOTO_BUCKET = "memory-photos";
/** Tetto del bucket (migration 20260903110000), in byte. Il client resta ben sotto. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Lato lungo massimo dopo il ridimensionamento (design approvato 2026-05). */
export const PHOTO_MAX_EDGE = 1600;
/** Qualità JPEG dell'UNICA ricodifica: la fa il manipulator, mai il picker. */
export const PHOTO_JPEG_QUALITY = 0.8;
/** Durata degli URL firmati, in secondi. */
export const PHOTO_URL_TTL_S = 60 * 60;
/** Gli oggetti più giovani di così NON sono orfani: potrebbe essere un upload in corso. */
export const PHOTO_RECONCILE_GRACE_MS = 10 * 60 * 1000;

export type PhotoSource = "camera" | "library";

/** La chiave dell'oggetto nel bucket: quella che finisce in memories.photo_path. */
export function photoPathFor(userId: string, memoryId: string): string {
  return `${userId}/${memoryId}.jpg`;
}

/**
 * Un SOLO lato al ridimensionatore: l'altro lo calcola il nativo mantenendo
 * le proporzioni (passarli entrambi deforma). null = già entro il limite —
 * il resize non ha clamp e ingrandirebbe.
 */
export function resizeTarget(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= PHOTO_MAX_EDGE) return null;
  return width >= height ? { width: PHOTO_MAX_EDGE } : { height: PHOTO_MAX_EDGE };
}

export type PhotoBytesCheck = "ok" | "empty" | "too_large" | "not_jpeg";

/**
 * Ultimo controllo prima dell'upload: dimensione sotto il tetto del bucket e
 * firma JPEG (FF D8 FF). Il bucket rifiuterebbe comunque (413 / 415), ma qui
 * l'errore è locale, immediato e non consuma rete.
 */
export function checkPhotoBytes(bytes: ArrayBuffer): PhotoBytesCheck {
  if (bytes.byteLength === 0) return "empty";
  if (bytes.byteLength > PHOTO_MAX_BYTES) return "too_large";
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  if (head.length < 3 || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    return "not_jpeg";
  }
  return "ok";
}

export type StoredPhoto = { name: string; createdAt: string | null };

/**
 * Oggetti nella cartella dell'utente che nessuna riga di memories referenzia
 * più: cestino purgato, update della riga fallito dopo un upload riuscito.
 * `referencedPaths` deve includere il CESTINO (un ricordo nel cestino si
 * ripristina, la sua foto non è orfana) ed essere COMPLETA: chi chiama la
 * ottiene da fetchPhotoPaths, che è paginata proprio per questo (PostgREST
 * tronca a max_rows senza errore). Una lista parziale qui trasforma foto vive
 * in orfani da cancellare. Gli oggetti più giovani della grazia restano:
 * potrebbero essere un upload in corso su un altro thread.
 */
export function orphanPhotoPaths(
  userId: string,
  objects: StoredPhoto[],
  referencedPaths: Iterable<string>,
  now: number = Date.now(),
): string[] {
  const referenced = new Set(referencedPaths);
  const orphans: string[] = [];
  for (const o of objects) {
    const path = `${userId}/${o.name}`;
    if (referenced.has(path)) continue;
    const created = o.createdAt ? Date.parse(o.createdAt) : Number.NaN;
    if (!Number.isNaN(created) && now - created < PHOTO_RECONCILE_GRACE_MS) continue;
    orphans.push(path);
  }
  return orphans;
}

export type SignedUrlCache = {
  get(path: string): string | null;
  set(path: string, url: string): void;
  invalidate(path: string): void;
  clear(): void;
};

/**
 * Cache in memoria degli URL firmati, per path. Un URL è "buono" finché manca
 * più del margine alla scadenza: così un'immagine che parte a caricarsi non
 * trova l'URL morto a metà. RN Image fa cache per URI, quindi riusare lo
 * stesso URL finché vale evita di riscaricare la stessa foto a ogni render.
 * `now` è iniettabile per i test.
 */
export function makeSignedUrlCache(opts: {
  ttlMs: number;
  refreshMarginMs?: number;
  now?: () => number;
}): SignedUrlCache {
  const now = opts.now ?? (() => Date.now());
  const margin = opts.refreshMarginMs ?? Math.min(5 * 60 * 1000, Math.floor(opts.ttlMs / 2));
  const entries = new Map<string, { url: string; expiresAt: number }>();
  return {
    get(path) {
      const entry = entries.get(path);
      if (!entry) return null;
      if (now() >= entry.expiresAt - margin) {
        entries.delete(path);
        return null;
      }
      return entry.url;
    },
    set(path, url) {
      entries.set(path, { url, expiresAt: now() + opts.ttlMs });
    },
    invalidate(path) {
      entries.delete(path);
    },
    clear() {
      entries.clear();
    },
  };
}
