/**
 * Foto sui ricordi — l'UNICO punto dell'app che parla con Supabase Storage.
 * (lib/api.ts resta il punto unico per le tabelle; qui solo il bucket.)
 *
 * Pipeline: picker (originale, quality 1 — anche HEIC) → manipulator (render
 * per le dimensioni vere, resize di UN lato se il lato lungo supera 1600,
 * JPEG q0.8: l'UNICA ricodifica) → bytes via fetch(file://) → upload come
 * ArrayBuffer → update di memories.photo_path.
 *
 * Il resize (resizeForUpload) lo chiama Add SUBITO DOPO la scelta, non qui:
 * l'anteprima mostra già il file piccolo (un originale da 12 MP decodificato
 * costa ~48 MB) e uploadMemoryPhoto riceve un JPEG pronto — una ricodifica
 * sola, e la strada del salvataggio non deve più decodificare niente.
 *
 * Perché ArrayBuffer: su React Native Blob/File/FormData non funzionano con
 * storage-js (node_modules/@supabase/storage-js/dist/index.d.cts:865); RN
 * codifica ArrayBuffer/typed array in base64 sul bridge da solo.
 *
 * Il CARICAMENTO avviene AL SALVATAGGIO, dopo che la riga esiste — il path
 * contiene memory_id. Niente file orfani di chi abbandona la schermata.
 *
 * Bucket PRIVATO: si legge solo con URL firmati (1 ora, cache in memoria).
 * Mai getPublicUrl. Ogni chiamata passa dal fetch dell'app con il timeout di
 * 15 s (lib/network.ts): una foto da 1600px/q0.8 pesa 200-500 KB e ci sta.
 *
 * Demo mode: tutto no-op.
 */
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat, type ImageResult } from "expo-image-manipulator";

import { fetchPhotoPaths, updateMemoryPhoto } from "./api";
import { isDemoMode, supabase } from "./supabase";
import {
  PHOTO_BUCKET,
  PHOTO_JPEG_QUALITY,
  PHOTO_URL_TTL_S,
  checkPhotoBytes,
  makeSignedUrlCache,
  orphanPhotoPaths,
  photoPathFor,
  resizeTarget,
  type PhotoBytesCheck,
  type PhotoSource,
  type StoredPhoto,
} from "./photo-utils";

export type { PhotoSource } from "./photo-utils";

export type PickOutcome =
  | { status: "picked"; uri: string }
  | { status: "canceled" }
  | { status: "denied" };

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"], // API nuova (MediaType[]); MediaTypeOptions è deprecata e logga un warn
  allowsEditing: false,
  quality: 1, // originale: l'unica compressione la fa il manipulator (due ricodifiche degradano)
  exif: false,
  base64: false,
  allowsMultipleSelection: false,
};

/** URL firmati per path, validi un'ora, buoni finché mancano più di 5 minuti alla scadenza. */
const urlCache = makeSignedUrlCache({ ttlMs: PHOTO_URL_TTL_S * 1000 });

/**
 * Apre fotocamera o libreria. La libreria (PHPicker / Android Photo Picker)
 * non chiede permessi; la fotocamera sì, e launchCameraAsync RIFIUTA se il
 * permesso non è già concesso — quindi prima lo chiediamo.
 */
export async function pickPhoto(source: PhotoSource): Promise<PickOutcome> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { status: "denied" };
  }
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(PICK_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS);
  if (result.canceled) return { status: "canceled" };
  const asset = result.assets[0];
  if (!asset) return { status: "canceled" };
  return { status: "picked", uri: asset.uri };
}

/**
 * Lato lungo ≤ 1600 px (proporzioni intatte), JPEG q0.8, nella cache dell'app.
 * Le dimensioni si leggono dal render, non dal picker: il picker può dare 0.
 * Su iOS il manipulator raddrizza l'orientamento EXIF al caricamento.
 * Contesto e ImageRef sono SharedObject con un bitmap nativo: release() sempre.
 */
export async function resizeForUpload(uri: string): Promise<ImageResult> {
  const context = ImageManipulator.manipulate(uri);
  const decoded = await context.renderAsync();
  try {
    const target = resizeTarget(decoded.width, decoded.height);
    if (target) context.resize(target);
    const final = target ? await context.renderAsync() : decoded;
    try {
      return await final.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY });
    } finally {
      if (final !== decoded) final.release();
    }
  } finally {
    decoded.release();
    context.release();
  }
}

/** I byte non sono un JPEG valido o superano il tetto: errore locale, niente rete. */
export class PhotoUploadError extends Error {
  constructor(public readonly reason: PhotoBytesCheck) {
    super(`photo bytes rejected: ${reason}`);
    this.name = "PhotoUploadError";
  }
}

/**
 * Carica il JPEG GIÀ ridimensionato (resizeForUpload lo ha prodotto alla
 * scelta, in Add) e scrive la chiave sulla riga. Ritorna la chiave.
 * Non ripassa dal manipulator: due ricodifiche degradano l'immagine.
 * Demo: null. Errori: si propagano — chi chiama (Add) lascia la riga com'è e
 * avvisa; perdere il testo per colpa di una foto sarebbe il peggiore dei due esiti.
 */
export async function uploadMemoryPhoto(
  userId: string,
  memoryId: string,
  jpegUri: string,
): Promise<string | null> {
  if (isDemoMode) return null;
  // fetch(file://) → ArrayBuffer: la via a zero dipendenze che RN 0.81 serve
  // sia su iOS (RCTFileRequestHandler) sia su Android (BlobModule).
  const bytes = await fetch(jpegUri).then((r) => r.arrayBuffer());
  const check = checkPhotoBytes(bytes);
  if (check !== "ok") throw new PhotoUploadError(check);
  const path = photoPathFor(userId, memoryId);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg", // obbligatorio con un body grezzo: il default è text/plain → 415
    upsert: true, // sostituire = stesso path; richiede la policy update
    cacheControl: "3600",
  });
  if (error) throw error;
  urlCache.invalidate(path);
  await updateMemoryPhoto(memoryId, path);
  return path;
}

/**
 * URL firmato per <Image source={{ uri }}>, valido un'ora, riusato dalla
 * cache finché non è a 5 minuti dalla scadenza. Demo: null (nessun bucket).
 */
export async function getPhotoUrl(path: string): Promise<string | null> {
  if (isDemoMode) return null;
  const cached = urlCache.get(path);
  if (cached) return cached;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, PHOTO_URL_TTL_S);
  if (error) throw error;
  urlCache.set(path, data.signedUrl);
  return data.signedUrl;
}

/**
 * Azzera la chiave sulla riga e POI rimuove il FILE (Storage API: l'unico modo
 * che cancelli davvero i byte). Per un ricordo vivo: il controllo post-
 * salvataggio non è in questo piano, ma l'API c'è. Demo: no-op.
 *
 * L'ordine è questo di proposito, ed è il rovescio di uploadMemoryPhoto (bucket
 * prima, riga dopo): fra le due chiamate la rete può cadere. Cancellando prima
 * i byte resterebbe una riga che punta a un oggetto inesistente — createSignedUrl
 * risponde 404 e getPhotoUrl lancerebbe a ogni render del retro, e reconcilePhotos
 * non la ripara: raccoglie oggetti orfani, non riferimenti orfani. Azzerando
 * prima la riga il caso peggiore è un file orfano, cioè esattamente il caso per
 * cui reconcilePhotos esiste.
 */
export async function removeMemoryPhoto(memoryId: string, path: string): Promise<void> {
  if (isDemoMode) return;
  await updateMemoryPhoto(memoryId, null);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
  urlCache.invalidate(path);
}

/**
 * Le purghe SQL (cestino 24h) non possono cancellare i FILE del bucket —
 * vedi il commento in testa alla migration 20260903110000. Quindi il client
 * riconcilia la PROPRIA cartella: elenca gli oggetti, li confronta con le
 * chiavi ancora referenziate (cestino incluso) e rimuove gli orfani.
 * Ritorna quanti ne ha rimossi. Demo: 0.
 *
 * La lista REFERENZIATA deve essere completa, perché la differenza è una
 * CANCELLA: se fetchPhotoPaths tornasse tronca, foto ancora vive finirebbero
 * fra gli orfani e non ci sarebbe modo di riattaccarle. Per questo pagina
 * avanzando di quante righe ha RICEVUTO e si ferma solo su una pagina vuota
 * (lib/api.ts), senza fidarsi del `max_rows` remoto.
 * Anche il list() del bucket si pagina qui (SearchOptions.limit ha default
 * 100, index.d.cts:267-285), ma quel lato sbaglia in sicurezza: una vista
 * parziale degli OGGETTI lascia indietro qualche orfano, non cancella nulla
 * di vivo.
 */
export async function reconcilePhotos(userId: string): Promise<number> {
  if (isDemoMode) return 0;
  const PAGE = 1000;
  const objects: StoredPhoto[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(userId, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const page = data ?? [];
    for (const o of page) {
      // id null = riga-CARTELLA sintetica, non un oggetto (index.d.cts:175-176,
      // "null for folders"): created_at è null e finirebbe fra gli orfani —
      // un remove() su una non-cosa.
      if (o.id === null) continue;
      objects.push({ name: o.name, createdAt: o.created_at });
    }
    if (page.length < PAGE) break; // ultima pagina
  }
  if (objects.length === 0) return 0;
  const referenced = await fetchPhotoPaths(userId);
  const orphans = orphanPhotoPaths(userId, objects, referenced);
  if (orphans.length === 0) return 0;
  const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(orphans);
  if (removeError) throw removeError;
  for (const p of orphans) urlCache.invalidate(p);
  return orphans.length;
}
