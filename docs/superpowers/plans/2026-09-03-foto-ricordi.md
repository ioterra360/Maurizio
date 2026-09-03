# Foto sui ricordi (Premium) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un utente Premium può allegare UNA foto a un ricordo dalla schermata Aggiungi (fotocamera o libreria); la foto vive in un bucket Storage privato, compare solo sul **retro** — anteprima in Add, scheda del ricordo e pannello di rivelazione dei tre ripassi — e sparisce con il ricordo.

**Architecture:** Il DB guadagna `memories.photo_path` (chiave dell'oggetto, mai un URL) e un bucket privato `memory-photos` con RLS per cartella-utente `<auth.uid()>/…`. Tutto ciò che parla con Storage sta in `lib/photos.ts` (picker → ridimensionamento **subito dopo la scelta**, così anteprima e upload usano lo stesso file piccolo → upload come `ArrayBuffer` al salvataggio → update della riga; URL firmati con cache in memoria); la logica pura (path, ridimensionamento, controllo dei byte, orfani, cache) sta in `lib/photo-utils.ts` ed è coperta da vitest. Il caricamento avviene **al salvataggio, dopo che la riga esiste**: se fallisce la riga resta e si avvisa. La pulizia dei file non può passare da SQL (vedi "Verità sulla cancellazione"): il client riconcilia la propria cartella a ogni apertura.

**Tech Stack:** TypeScript, Expo SDK 54 / React Native 0.81, expo-image-picker 17.0.11, expo-image-manipulator 14.0.8 (API a contesto), @supabase/supabase-js 2.106 (Storage), Supabase migrazioni SQL, vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md` (§B5, righe 728-763; §"Ordine di esecuzione" e §"Rischi"). Decisioni di agosto (FINALI): memoria `photo_upload_feature.md` — foto solo sul retro, bucket privato, path `<user_id>/<memory_id>.jpg`, 1600px lato lungo JPEG 0.8, upload dopo che la riga esiste, fallimento = riga resta + toast, stringhe iOS dei permessi.

## Global Constraints

- **Ordine rispetto agli altri tre piani della build 3, sullo stesso branch `build-3`:** `build3-config-nativa Task 1-4` → `notifiche-locali` → `piani-paywall-revenuecat` → **questo piano** → `build3-config-nativa Task 5-6`. Questo è l'ULTIMO piano di codice, quindi è quello che rischia di più: `app.json` è già scritto (Task 10 qui è una verifica), `lib/plan.ts` e `lib/use-plan.ts` sono già quelli veri di B4 (niente stub), e `app/add.tsx` porta già il pre-prompt delle notifiche e il blocco del tetto di piano. **Ogni innesto in `app/add.tsx` è additivo e ancorato al testo: riscrivere `doSave` per intero cancellerebbe in silenzio il lavoro degli altri due piani, e `tsc` non se ne accorgerebbe.**
- **Node/test:** `npm test` = `vitest run`. Il config raccoglie SOLO `features/**/*.test.ts` e `lib/**/*.test.ts` (`vitest.config.ts`). Niente test su `app/` o `components/`. Un test che importa un modulo nativo (`expo-image-picker`, `@/lib/supabase`) NON gira in Node: i test coprono solo `lib/photo-utils.ts`, `lib/mappers.ts`, `lib/queue.ts`.
- **Typecheck:** `npm run lint` = `tsc --noEmit`. Deve passare a ogni commit. `tsconfig.json` include anche i test: una proprietà obbligatoria nuova su `Memory` rompe le fixture di `lib/queue.test.ts:14-35` e `lib/folder-sort.test.ts:7-25` — vanno aggiornate nello stesso commit.
- **i18n:** `TKey = keyof typeof it` — una chiave aggiunta al solo `it.ts` è un errore di compilazione. `lib/i18n/i18n.test.ts:19-36` impone insiemi di chiavi identici, `{placeholder}` identici e nessuna stringa vuota su **it/en/fr/es**. Nessun literal italiano in TSX.
- **Demo mode:** ogni funzione che tocca la rete inizia con `if (isDemoMode) return …`. Vale anche per `lib/photos.ts`.
- **Errori:** ogni `catch` passa da `reportError(tag, err)` (`lib/report-error.ts`). Niente `console.warn`.
- **Il bucket è PRIVATO e resta privato.** Mai `public = true`, mai `getPublicUrl`. Solo URL firmati. Storage si tocca SOLO da `lib/photos.ts`; le tabelle restano in `lib/api.ts`.
- **La foto sta SOLO sul retro.** Mai sul fronte, mai prima della rivelazione nei ripassi.
- **Upload come `ArrayBuffer`.** Su React Native `Blob`, `File` e `FormData` non funzionano con storage-js (`node_modules/@supabase/storage-js/dist/index.d.cts:865`). `contentType: "image/jpeg"` è obbligatorio con un body grezzo: il default è `text/plain` e il bucket, che accetta solo `image/jpeg`, risponderebbe 415.
- **Nativo = build 3, e `app.json` NON è di questo piano.** Il plugin `expo-image-picker` cambia il fingerprint e viaggia nella stessa build di F1/F3/B4 (spec §"Ordine di esecuzione"), non in OTA. Il file lo possiede il piano `2026-09-03-build3-config-nativa.md` (Task 2), che nell'ordine di esecuzione concordato gira **prima** di questo e scrive già le due frasi italiane, `microphonePermission: false` e `blockedPermissions: ["android.permission.RECORD_AUDIO"]`. Il Task 10 qui sotto è quindi una **verifica**, non una seconda scrittura: una voce `expo-image-picker` duplicata in `expo.plugins` farebbe girare il plugin due volte.
- **La migrazione NON si applica in produzione da questo piano.** `npx supabase db push` sul progetto `taekvxxljtgzsjrlmumo` è un passo umano di Angelo, insieme alla migrazione di B4, prima della build 3.
- **Lingua:** commenti e copy in italiano; simboli in inglese.

---

## Decisioni fissate da questo piano

Cose che la spec lascia aperte e che il codice qui sotto chiude una volta per tutte. Non sono da ridiscutere durante l'esecuzione.

| Tema | Decisione | Perché |
|---|---|---|
| Cosa contiene `photo_path` | La chiave bucket-relativa `<user_id>/<memory_id>.jpg`, senza prefisso bucket | `upload`, `createSignedUrl` e `remove` vogliono tutte la chiave dentro `from("memory-photos")`; un URL firmato scade |
| Come si mostra una foto privata | `createSignedUrl(path, 3600)` per carta, al momento del render, con cache in memoria che considera scaduto un URL 5 minuti prima della scadenza vera | Niente URL persistiti; `RN Image` cache per URI, quindi lo stesso URL va riusato finché vale |
| Pipeline immagine | Picker con `quality: 1` (originale, anche HEIC) → manipulator: render per le dimensioni vere, `resize` di UN solo lato se il lato lungo > 1600, `saveAsync({ format: JPEG, compress: 0.8 })` → `fetch(file://).arrayBuffer()` | Una sola ricodifica JPEG (due degradano); il manipulator normalizza HEIC/PNG a JPEG; `fetch(file://)` è la via a zero dipendenze che RN 0.81 serve su iOS e Android |
| Quando si ridimensiona | Subito **alla scelta** della foto (in `handlePickPhoto`), non al salvataggio: `photoUri` è già il JPEG piccolo, e anteprima e upload usano lo stesso file. Il **caricamento** resta al salvataggio | Un originale da 12 MP decodificato costa ~48 MB in memoria: `<Image>` lo decodifica a piena risoluzione anche dentro un box da 240. Ricodifiche sempre una sola: `uploadMemoryPhoto` riceve un file già pronto e non ripassa dal manipulator |
| `upsert: true` | Sì — sostituire la foto scrive sullo stesso path | Un path stabile per ricordo; richiede la policy `update` sul bucket |
| Gate Premium | Client, tramite `canUsePhotos(plan)` di `lib/plan.ts` (interfaccia di B4). **Il gate lato server sul `photo_path` NON esiste in questo ciclo**: la migrazione di B4 (`20260903100000_plans.sql`) porta tre trigger `BEFORE INSERT` sui tetti di ricordi, cartelle e sezioni e **nessun ramo su `photo_path`**. Aggiungerlo è il punto 3 di §"Passi umani aperti", e non appartiene né a B4 né a questo piano | La spec §B5 descrive solo il gate client; la colonna `profiles.plan` e i trigger nascono con B4, ma B4 non è stato esteso alle foto e allargarlo qui sarebbe scope non deciso. Finché il punto 3 non è fatto, chi conosce la REST API può scrivere `photo_path` da free |
| Foto dopo il salvataggio | **Fuori scope.** La scheda ricordo MOSTRA la foto (spec :756-757 la elenca come superficie di visualizzazione), non la modifica. `removeMemoryPhoto` in `lib/photos.ts` esiste come API per il controllo futuro | Niente scope in più; il costo è che un upload fallito non ha via di ritentare se non ricreando il ricordo — accettato, vedi Rischi |
| Salva e aggiungi un altro | Azzera la foto scelta, in ogni caso | È contenuto del ricordo, non contesto di sessione: se restasse, il salvataggio successivo la caricherebbe sotto un altro `memory_id` |

Il coach tip "Allega una foto" della memoria di agosto (punto 7) **non è chiuso da questo piano**: resta una decisione di Angelo, vedi "Passi umani aperti" §6.

### Verità sulla cancellazione dei file

Il compito chiedeva di estendere `delete_own_account()` con `delete from storage.objects …` e di far rimuovere a `purge_trash()` gli oggetti dei ricordi purgati. **Non si fa così, e il piano lo dice chiaro:**

1. `delete from storage.objects` in SQL **non cancella il file**: rimuove la riga di metadati e lascia il blob su S3 (fatturato, irraggiungibile). Docs Supabase "Deleting objects via a SQL query will not remove the object from the bucket and will result in the object being orphaned"; foglio API Storage, sezione pitfalls.
2. Sui progetti con la migrazione storage `0055-prevent-direct-deletes.sql` il delete diretto è proprio **bloccato** (`storage.protect_delete()`, errcode 42501): una `delete_own_account()` che lo tenta fallisce.
3. Cancellare la riga di metadati rende il file anche **invisibile** a `list()`/`remove()`: nessun job futuro potrebbe più trovarlo. Quindi peggiora, non migliora.
4. `delete_own_account()` non è più chiamata dall'app (`20260830121000_account_deletion_grace.sql:6`; `lib/api.trash.test.ts:244`): la cancellazione vera è `purge_expired_accounts()` da pg_cron, senza JWT — lì `auth.uid()` è NULL e il filtro `owner = auth.uid()` del vecchio TODO non troverebbe nulla comunque.
5. `storage.objects` non ha FK verso `auth.users` (migrazione storage 0017): cancellare l'utente non cascata sugli oggetti.

**L'alternativa onesta, implementata qui:**

- **Ricordi purgati dal cestino** (`purge_trash`, 24h): il client **riconcilia** a ogni apertura del gruppo `(app)`: `list("<user_id>")` sul bucket, confronto con `select photo_path from memories where user_id = … and photo_path is not null` (cestino INCLUSO — un ricordo nel cestino si ripristina), `remove()` di ciò che non ha più una riga. Copre anche un upload riuscito con update della riga fallito. RLS: solo select/delete propri, nessun privilegio nuovo.
- **Account purgati** (`purge_expired_accounts`, 72h): nessun client resta a riconciliare. I file **restano orfani** finché non esiste un job con `service_role` (Edge Function schedulata che elenca le cartelle di primo livello del bucket e rimuove quelle senza `profiles`). È un **passo umano aperto** (AGENTS.md §7: GDPR → chiedere), documentato in `docs/DATA-MODEL.md`. Non si cancellano le foto al momento della *richiesta* di eliminazione: chi recupera l'account entro 72 ore le perderebbe.
- Le tre funzioni SQL (`delete_own_account`, `purge_trash`, `purge_expired_accounts`) **non vengono toccate**. Il commento in testa alla migrazione spiega perché, così il prossimo agente non "completa" il TODO sbagliato di `20260825152550_delete_own_account.sql:20-22`.

---

## File Structure

| File | Responsabilità |
|---|---|
| `supabase/migrations/20260903110000_memory_photos.sql` **(nuovo)** | Colonna `photo_path`, bucket privato, quattro policy su `storage.objects`. |
| `lib/photo-utils.ts` **(nuovo)** | Costanti, `photoPathFor`, `resizeTarget`, `checkPhotoBytes`, `orphanPhotoPaths`, `makeSignedUrlCache`. Puro, nessun import nativo. |
| `lib/photo-utils.test.ts` **(nuovo)** | Copertura dei cinque helper con orologio iniettato. |
| `lib/photos.ts` **(nuovo)** | L'unico accesso a Storage: `pickPhoto`, `resizeForUpload`, `uploadMemoryPhoto`, `getPhotoUrl`, `removeMemoryPhoto`, `reconcilePhotos`. |
| `lib/plan.ts` · `lib/use-plan.ts` | Interfacce di B4, in DUE moduli distinti: `lib/plan.ts` esporta `type Plan` e `canUsePhotos(plan)` (puro); `lib/use-plan.ts` esporta l'hook `usePlan(): Plan`. Stub di entrambi solo se B4 non è ancora a bordo (Task 7, Step 1). |
| `lib/mappers.ts` | `MemoryRow.photo_path`, `Memory.photoPath`. |
| `lib/queue.ts` | `toReviewCard` porta `photoPath`. |
| `lib/review-store.ts` | `ReviewCard.photoPath`. |
| `lib/api.ts` | `updateMemoryPhoto`, `fetchPhotoPaths`; il ricordo demo porta `photoPath: null`. |
| `lib/mappers.photo.test.ts` **(nuovo)**, `lib/queue.test.ts`, `lib/folder-sort.test.ts` | Mapping e fixture. |
| `lib/i18n/{it,en,fr,es}.ts` | 14 chiavi nuove. |
| `components/MemoryPhoto.tsx` **(nuovo)** | La foto sul retro: risolve l'URL firmato, 4:3, angoli 12, cover, max 240. |
| `components/PhotoSheet.tsx` **(nuovo)** | Foglio Fotocamera / Libreria / Rimuovi. |
| `app/add.tsx` | Il `+` nel box del significato, gate Premium, anteprima sul retro, upload al salvataggio. |
| `app/memory/[id].tsx`, `app/review/{scan,focus,reinforcement}.tsx` | Rendering sul retro. |
| `app/(app)/_layout.tsx` | Riconciliazione una volta per utente. |
| `app.json` | **Di proprietà del piano di configurazione nativa** (`2026-09-03-build3-config-nativa.md`, Task 2), che scrive il plugin `expo-image-picker` con le stringhe italiane e senza microfono. Qui si verifica soltanto (Task 10). |
| `docs/DATA-MODEL.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `README.md` | Bucket, policy, cancellazione, regola dura. |

---

### Task 1: Migrazione — colonna, bucket privato, policy per utente

**Files:**
- Create: `supabase/migrations/20260903110000_memory_photos.sql`

**Interfaces:**
- Produces: `public.memories.photo_path text` (null = nessuna foto; check 1-512 caratteri); bucket `memory-photos` (`public = false`, 5 MiB, solo `image/jpeg`); policy `memory_photos_select_own`, `memory_photos_insert_own`, `memory_photos_update_own`, `memory_photos_delete_own` su `storage.objects` per `authenticated`.

- [ ] **Step 1: Scrivere la migrazione**

Crea `supabase/migrations/20260903110000_memory_photos.sql`:

```sql
-- Foto sui ricordi (Premium) — spec 2026-09-02 §B5 + design approvato ad
-- agosto (memoria photo_upload_feature): bucket PRIVATO, una foto per
-- ricordo, path <user_id>/<memory_id>.jpg, foto solo sul retro.
--
-- Cosa fa:
--   1. memories.photo_path — la CHIAVE dell'oggetto nel bucket, mai un URL
--      (il bucket è privato e gli URL firmati scadono). null = nessuna foto.
--      Nessun grant di colonna: memories ha solo la policy per riga
--      (memories_all_own_or_admin, initial_schema.sql:237), come notes.
--   2. bucket 'memory-photos', privato, 5 MiB, solo image/jpeg. Il client
--      ridimensiona a 1600px di lato lungo e ricodifica JPEG q0.8 PRIMA di
--      caricare (lib/photos.ts): 5 MiB è un tetto di sicurezza, non un target.
--      file_size_limit è in BYTE (bigint), allowed_mime_types è text[].
--   3. RLS su storage.objects: ogni utente vede, scrive e cancella SOLO gli
--      oggetti sotto la propria cartella <auth.uid()>/…  —
--      (storage.foldername(name))[1] è il primo segmento del path. La spec
--      diceva "owner = auth.uid()": la colonna storage.objects.owner è
--      DEPRECATA sull'hosted (esiste owner_id text); il prefisso del path è la
--      forma canonica dei docs e in più vincola DOVE si può scrivere.
--      `to authenticated`: anon non tocca il bucket. Le policy stanno su
--      storage.objects e basta: nessuna chiamata dello SDK ha bisogno di
--      permessi su storage.buckets. La policy update serve perché il client
--      carica con upsert:true (sostituire una foto = stesso path).
--
-- Cosa NON fa, di proposito — pulizia dei FILE:
--   `delete from storage.objects` in SQL non cancella il file su S3: toglie la
--   riga di metadati e lascia il blob (fatturato, irraggiungibile — docs
--   Supabase: "Deleting objects via a SQL query will not remove the object
--   from the bucket and will result in the object being orphaned"). Sui
--   progetti con la migrazione storage 0055 il delete diretto è bloccato
--   (storage.protect_delete, 42501). E una riga cancellata rende il file
--   INVISIBILE a list()/remove(): impossibile da pulire dopo.
--   Quindi purge_trash(), purge_expired_accounts() e delete_own_account()
--   NON toccano storage.objects — il TODO in 20260825152550:20-22 è superato.
--   - Ricordi purgati dal cestino: il client riconcilia la propria cartella
--     (lib/photos.ts reconcilePhotos) via Storage API, con le policy qui sotto.
--   - Account purgati (72h): nessun client resta; i file restano orfani finché
--     non esiste un job con service_role (Edge Function). Decisione aperta,
--     vedi docs/DATA-MODEL.md § Storage.

-- (1) colonna
alter table public.memories
  add column if not exists photo_path text
    check (photo_path is null or char_length(photo_path) between 1 and 512);

comment on column public.memories.photo_path is
  'Chiave dell''oggetto nel bucket privato memory-photos (<user_id>/<memory_id>.jpg). null = nessuna foto. Mai un URL: si legge con URL firmati (lib/photos.ts).';

-- (2) bucket — idempotente: rieseguire la migration aggiorna i limiti.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (3) policy — i nomi sono globali per tabella: drop-if-exists prima.
-- auth.uid() dentro (select …) viene valutato una volta per query (initPlan).
drop policy if exists "memory_photos_select_own" on storage.objects;
create policy "memory_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_insert_own" on storage.objects;
create policy "memory_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_update_own" on storage.objects;
create policy "memory_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_delete_own" on storage.objects;
create policy "memory_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
```

- [ ] **Step 2: Verificare l'ordine delle migrazioni SENZA applicare e SENZA collegare il worktree**

`memika-build3` **non è collegato** al progetto Supabase e non va collegato: gli altri due piani della build 3 danno per assodato che l'unico albero linkato sia `memika-app` (`db push` qui fallisce con "Cannot find project ref"). Un `supabase link` da qui creerebbe un `supabase/.temp` e un secondo albero capace di scrivere in produzione. Quindi la verifica dell'ordine si fa sui nomi dei file, che è tutto ciò che conta:

```bash
ls supabase/migrations/2026090*.sql
```

Expected: `20260903100000_plans.sql` (B4) **prima** di `20260903110000_memory_photos.sql` (questo piano) in ordine lessicografico — è l'ordine in cui `db push` le applicherà. Se la migrazione di B4 non c'è ancora, va bene: le due sono indipendenti, e questa non referenzia né `profiles.plan` né i suoi trigger.

Il `npx supabase db push --dry-run` vero lo esegue Angelo da `memika-app`, allo Step 3.

- [ ] **Step 3: Passo UMANO — applicazione e verifica (Angelo, insieme a B4, prima della build 3)**

Angelo esegue `npx supabase db push` dal worktree scelto. Subito dopo, nella SQL console (o via Management API, ricetta in AGENTS.md §5):

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'memory-photos';

select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'memory_photos_%'
order by policyname;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'memories' and column_name = 'photo_path';
```

Expected: bucket `public = false`, `file_size_limit = 5242880`, `allowed_mime_types = {image/jpeg}`; quattro policy (`DELETE`, `INSERT`, `SELECT`, `UPDATE`); colonna `text`, nullable. Il piano non dipende da questo passo per i commit seguenti: il client tollera la colonna assente (`photo_path?` opzionale nel mapper).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260903110000_memory_photos.sql
git commit -m "$(cat <<'EOF'
feat(db): colonna photo_path, bucket privato memory-photos e policy per cartella-utente

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Helper puri — path, ridimensionamento, byte, orfani, cache URL

**Files:**
- Create: `lib/photo-utils.ts`
- Create: `lib/photo-utils.test.ts`

**Interfaces:**
- Produces:
  - `PHOTO_BUCKET = "memory-photos"`, `PHOTO_MAX_BYTES = 5242880`, `PHOTO_MAX_EDGE = 1600`, `PHOTO_JPEG_QUALITY = 0.8`, `PHOTO_URL_TTL_S = 3600`, `PHOTO_RECONCILE_GRACE_MS = 600000`
  - `type PhotoSource = "camera" | "library"`
  - `photoPathFor(userId: string, memoryId: string): string`
  - `resizeTarget(width: number, height: number): { width: number } | { height: number } | null`
  - `type PhotoBytesCheck = "ok" | "empty" | "too_large" | "not_jpeg"`; `checkPhotoBytes(bytes: ArrayBuffer): PhotoBytesCheck`
  - `type StoredPhoto = { name: string; createdAt: string | null }`; `orphanPhotoPaths(userId: string, objects: StoredPhoto[], referencedPaths: Iterable<string>, now?: number): string[]`
  - `type SignedUrlCache = { get(path: string): string | null; set(path: string, url: string): void; invalidate(path: string): void; clear(): void }`; `makeSignedUrlCache(opts: { ttlMs: number; refreshMarginMs?: number; now?: () => number }): SignedUrlCache`

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `lib/photo-utils.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- lib/photo-utils.test.ts`
Expected: FAIL — `Failed to resolve import "./photo-utils"`.

- [ ] **Step 3: Scrivere `lib/photo-utils.ts`**

```ts
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
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- lib/photo-utils.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run lint
git add lib/photo-utils.ts lib/photo-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(photos): helper puri — path, ridimensionamento, controllo dei byte, orfani, cache URL firmati

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Modello e api — `photoPath` viaggia con il ricordo e con la carta

**Files:**
- Modify: `lib/mappers.ts` — `MemoryRow`, `Memory`, `mapMemory` (B4 ha già aggiunto tre campi a `ProfileRow`/`Profile`/`mapProfile` più sopra: le righe si sono spostate di ~10, gli anchor testuali no)
- Modify: `lib/review-store.ts:26-47` (`ReviewCard`)
- Modify: `lib/queue.ts:148-165` (`toReviewCard`)
- Modify: `lib/api.ts` — accanto a `updateMemoryNotes` e nel ricordo demo di `fetchFolderDetail` (B4 ci ha già inserito `syncPlan` e `countMemories`, ~35 righe: usa i nomi, non i numeri)
- Modify: `lib/queue.test.ts:14-35`, `lib/folder-sort.test.ts:7-25` (fixture)
- Create: `lib/mappers.photo.test.ts`

**Interfaces:**
- Produces: `MemoryRow.photo_path?: string | null`; `Memory.photoPath: string | null`; `ReviewCard.photoPath?: string`; `updateMemoryPhoto(id: string, photoPath: string | null): Promise<void>`; `fetchPhotoPaths(userId: string): Promise<string[]>`.

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `lib/mappers.photo.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapMemory, type MemoryRow } from "./mappers";

const row = (over: Partial<MemoryRow> = {}): MemoryRow => ({
  id: "m1",
  user_id: "u1",
  folder_id: "f1",
  term: "embargo",
  reading: null,
  definition: "blocco commerciale",
  example: null,
  item_type: null,
  state: "active",
  srs_interval_days: 0,
  srs_ease_factor: 2.5,
  srs_repetitions: 0,
  last_reviewed_at: null,
  next_review_at: "2026-09-03T06:00:00.000Z",
  review_phase: "p20h",
  review_window_end: "2026-09-04T10:00:00.000Z",
  recovery_from: null,
  created_at: "2026-09-02T10:00:00.000Z",
  updated_at: "2026-09-02T10:00:00.000Z",
  ...over,
});

describe("mapMemory — photo_path", () => {
  it("porta la chiave dell'oggetto nel modello", () => {
    expect(mapMemory(row({ photo_path: "u1/m1.jpg" })).photoPath).toBe("u1/m1.jpg");
  });

  it("null resta null", () => {
    expect(mapMemory(row({ photo_path: null })).photoPath).toBeNull();
  });

  it("una riga senza la colonna (client vecchio, migrazione non ancora applicata) → null", () => {
    expect(mapMemory(row()).photoPath).toBeNull();
  });
});
```

In `lib/queue.test.ts`, dentro `describe("toReviewCard", …)` (riga 83), aggiungi:

```ts
  it("porta photoPath sulla carta, undefined quando il ricordo non ha foto", () => {
    expect(toReviewCard(mem({ photoPath: "u1/m1.jpg" }), "Spanish").photoPath).toBe("u1/m1.jpg");
    expect(toReviewCard(mem(), "Spanish").photoPath).toBeUndefined();
  });
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

Run: `npm test -- lib/mappers.photo.test.ts lib/queue.test.ts`
Expected: FAIL — vitest non fa typecheck, quindi i test girano e falliscono a runtime: `mapMemory` non conosce `photo_path` (`photoPath` è `undefined`, non `"u1/m1.jpg"` né `null`) e `toReviewCard` non copia il campo.

- [ ] **Step 3: Estendere `lib/mappers.ts`**

In `MemoryRow`, sotto `notes?: string | null;` (riga 210), aggiungi:

```ts
  /** Chiave nel bucket memory-photos (migration 20260903110000). Opzionale: le righe lette da un client vecchio non ce l'hanno. */
  photo_path?: string | null;
```

In `Memory`, sotto `notes?: string | null;` (riga 240), aggiungi:

```ts
  /** Chiave nel bucket privato memory-photos; null = nessuna foto. Mai un URL. */
  photoPath: string | null;
```

In `mapMemory`, sotto `notes: row.notes ?? null,` (riga 272), aggiungi:

```ts
    photoPath: row.photo_path ?? null,
```

- [ ] **Step 4: Aggiornare le fixture che costruiscono un `Memory` intero**

`Memory.photoPath` è obbligatoria, quindi `tsc` fallisce sulle fixture finché non la portano. In `lib/queue.test.ts`, dentro `mem` (riga 14-35), sotto `deletedAt: null,` aggiungi:

```ts
  photoPath: null,
```

Stessa riga in `lib/folder-sort.test.ts`, dentro la fixture alle righe 7-25, sotto `deletedAt: null,`.

In `lib/api.ts`, nel ricordo demo costruito da `fetchFolderDetail` (blocco alle righe ~640-654), sotto `deletedAt: null,` (riga 651) aggiungi:

```ts
      photoPath: null,
```

- [ ] **Step 5: `ReviewCard` e `toReviewCard`**

In `lib/review-store.ts`, nel tipo `ReviewCard` (righe 26-47), sotto `hint?: string;` (riga 34) aggiungi:

```ts
  /** Chiave nel bucket memory-photos. Si mostra SOLO nel pannello rivelato. Le carte demo la omettono. */
  photoPath?: string;
```

In `lib/queue.ts`, in `toReviewCard` (righe 148-165), sotto `hint: m.example ?? undefined,` aggiungi:

```ts
    photoPath: m.photoPath ?? undefined,
```

- [ ] **Step 6: Le due funzioni api**

In `lib/api.ts`, subito dopo `updateMemoryNotes` (riga 420), aggiungi:

```ts
/**
 * Scrive (o azzera con null) la chiave della foto sul ricordo. La chiamano
 * uploadMemoryPhoto e removeMemoryPhoto in lib/photos.ts, DOPO che il bucket
 * ha risposto: la riga dice la verità su ciò che esiste. Demo: no-op.
 */
export async function updateMemoryPhoto(id: string, photoPath: string | null): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase
    .from("memories")
    .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Tutte le chiavi foto dell'utente, CESTINO INCLUSO: un ricordo nel cestino
 * si può ripristinare, quindi la sua foto non è orfana. Serve alla
 * riconciliazione degli oggetti (lib/photos.ts reconcilePhotos). Demo: [].
 *
 * PAGINATA di proposito, e con un `order` stabile. PostgREST tronca ogni
 * select a max_rows (1000 su questo progetto, supabase/config.toml:18) SENZA
 * errore: una lista referenziata parziale farebbe classificare come orfane —
 * e quindi CANCELLARE — foto ancora vive. Senza `order` le pagine si
 * sovrappongono e il buco resta.
 */
export async function fetchPhotoPaths(userId: string): Promise<string[]> {
  if (isDemoMode) return [];
  const PAGE = 1000;
  const out: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("memories")
      .select("photo_path")
      .eq("user_id", userId)
      .not("photo_path", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    // Cast al confine: il client non è tipizzato sullo schema (lib/supabase.ts:103).
    const rows = (data ?? []) as { photo_path: string | null }[];
    for (const r of rows) if (r.photo_path) out.push(r.photo_path);
    if (rows.length < PAGE) return out; // ultima pagina
  }
}
```

- [ ] **Step 7: Eseguire tutto, typecheck, commit**

```bash
npm test
npm run lint
git add lib/mappers.ts lib/mappers.photo.test.ts lib/review-store.ts lib/queue.ts lib/queue.test.ts lib/folder-sort.test.ts lib/api.ts
git commit -m "$(cat <<'EOF'
feat(photos): photo_path nel modello, nelle carte di ripasso e nell'api

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/photos.ts` — picker, ridimensionamento, upload, URL firmati, riconciliazione

**Files:**
- Create: `lib/photos.ts`

**Interfaces:**
- Consumes: `updateMemoryPhoto`, `fetchPhotoPaths` (Task 3); tutto `lib/photo-utils.ts` (Task 2); `isDemoMode`, `supabase` da `./supabase`.
- Produces:
  - `type PickOutcome = { status: "picked"; uri: string } | { status: "canceled" } | { status: "denied" }`
  - `pickPhoto(source: PhotoSource): Promise<PickOutcome>`
  - `resizeForUpload(uri: string): Promise<ImageResult>` (`{ uri, width, height }`) — la chiama **Add alla scelta** della foto
  - `class PhotoUploadError extends Error { reason: PhotoBytesCheck }`
  - `uploadMemoryPhoto(userId: string, memoryId: string, jpegUri: string): Promise<string | null>` — riceve un file GIÀ ridimensionato
  - `getPhotoUrl(path: string): Promise<string | null>`
  - `removeMemoryPhoto(memoryId: string, path: string): Promise<void>`
  - `reconcilePhotos(userId: string): Promise<number>`
  - ri-esporta `type PhotoSource`

Niente vitest (importa moduli nativi): la verifica è `npm run lint` + il dispositivo.

- [ ] **Step 1: Scrivere `lib/photos.ts`**

```ts
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
 * Rimuove il FILE (Storage API: l'unico modo che cancelli davvero i byte) e
 * azzera la chiave sulla riga. Per un ricordo vivo: il controllo post-
 * salvataggio non è in questo piano, ma l'API c'è. Demo: no-op.
 */
export async function removeMemoryPhoto(memoryId: string, path: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
  urlCache.invalidate(path);
  await updateMemoryPhoto(memoryId, null);
}

/**
 * Le purghe SQL (cestino 24h) non possono cancellare i FILE del bucket —
 * vedi il commento in testa alla migration 20260903110000. Quindi il client
 * riconcilia la PROPRIA cartella: elenca gli oggetti, li confronta con le
 * chiavi ancora referenziate (cestino incluso) e rimuove gli orfani.
 * Ritorna quanti ne ha rimossi. Demo: 0.
 *
 * Le DUE liste devono essere complete, perché la differenza è una CANCELLA:
 * fetchPhotoPaths è paginata (PostgREST tronca a max_rows senza errore) e
 * anche il list() del bucket si pagina qui (SearchOptions.limit ha default
 * 100, index.d.cts:267-285). Una vista parziale da una parte o dall'altra
 * cancellerebbe foto vive, e non c'è modo di riattaccarle.
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: nessun errore, e in particolare nessun errore su `objects.push({ name: o.name, createdAt: o.created_at })`: `FileObject.created_at` è già `string | null` (`node_modules/@supabase/storage-js/dist/index.d.cts:179-180`, "Creation timestamp (null for folders)"), quindi combacia con `StoredPhoto.createdAt` senza `?? null` e senza cast. `npm run lint` è `tsc --noEmit` nudo: non esiste una regola tipo `noUnnecessaryCondition` che possa lamentarsi qui.

- [ ] **Step 3: Commit**

```bash
git add lib/photos.ts
git commit -m "$(cat <<'EOF'
feat(photos): pipeline foto — picker, ridimensionamento, upload come ArrayBuffer, URL firmati, riconciliazione

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: La copy in quattro lingue

**Files:**
- Modify: `lib/i18n/it.ts` (in fondo al file, prima di `} as const;`)
- Modify: `lib/i18n/en.ts`, `lib/i18n/fr.ts`, `lib/i18n/es.ts` (in fondo al file, prima di `};`)

> Nessun numero di riga: i piani notifiche e B4, che girano prima, hanno già
> aggiunto ~90 chiavi ai quattro cataloghi. Nessuna delle 14 chiavi qui sotto
> collide con le loro (`notifications.*`, `plan.*`, `paywall.*`, `planLimit.*`,
> `add.totalCounter`, `add.totalLimitReached`): controlla comunque con
> `grep -n "add.photo" lib/i18n/it.ts` che non esistano già.

**Interfaces:**
- Produces: le 14 chiavi qui sotto, disponibili come `TKey`.

- [ ] **Step 1: Aggiungere il blocco a `it.ts`**

Subito prima della riga `} as const;` in fondo a `lib/i18n/it.ts`:

```ts
  // ---- foto sui ricordi (B5, 2026-09-03) ----
  "add.photoAdd": "Aggiungi una foto",
  "add.photoChange": "Cambia foto",
  "add.photoSheetTitle": "Foto sul retro",
  "add.photoCamera": "Scatta una foto",
  "add.photoLibrary": "Scegli dalla libreria",
  "add.photoRemove": "Rimuovi foto",
  "add.photoPermissionDenied": "Senza il permesso per la fotocamera non posso scattare. Puoi concederlo nelle impostazioni del telefono.",
  "add.photoPickFailed": "Non sono riuscito a prendere la foto. Riprova.",
  "add.photoUploadFailed": "Salvato in {name}, ma la foto non è stata caricata. Il ricordo è al sicuro.",
  "add.photoPremiumTitle": "Le foto sono di Premium",
  "add.photoPremiumBody": "Una foto sul retro aiuta la memoria visiva: la vedi solo dopo aver provato a ricordare. Con Memika Premium puoi allegarne una a ogni ricordo.",
  "add.photoPremiumConfirm": "Scopri Premium",
  "add.photoPremiumCancel": "Non ora",
  "memory.photoA11y": "Foto del ricordo",
```

- [ ] **Step 2: `en.ts`**

Subito prima di `};`:

```ts
  // ---- memory photos (B5, 2026-09-03) ----
  "add.photoAdd": "Add a photo",
  "add.photoChange": "Change photo",
  "add.photoSheetTitle": "Photo on the back",
  "add.photoCamera": "Take a photo",
  "add.photoLibrary": "Choose from library",
  "add.photoRemove": "Remove photo",
  "add.photoPermissionDenied": "Without camera permission I can't take a photo. You can grant it in your phone settings.",
  "add.photoPickFailed": "I couldn't get the photo. Try again.",
  "add.photoUploadFailed": "Saved to {name}, but the photo was not uploaded. Your memory is safe.",
  "add.photoPremiumTitle": "Photos are a Premium feature",
  "add.photoPremiumBody": "A photo on the back helps visual memory: you see it only after trying to recall. With Memika Premium you can attach one to every memory.",
  "add.photoPremiumConfirm": "Discover Premium",
  "add.photoPremiumCancel": "Not now",
  "memory.photoA11y": "Memory photo",
```

- [ ] **Step 3: `fr.ts`**

```ts
  // ---- photos des souvenirs (B5, 2026-09-03) ----
  "add.photoAdd": "Ajouter une photo",
  "add.photoChange": "Changer la photo",
  "add.photoSheetTitle": "Photo au verso",
  "add.photoCamera": "Prendre une photo",
  "add.photoLibrary": "Choisir dans la galerie",
  "add.photoRemove": "Retirer la photo",
  "add.photoPermissionDenied": "Sans l'autorisation de l'appareil photo, je ne peux pas prendre de photo. Tu peux l'accorder dans les réglages du téléphone.",
  "add.photoPickFailed": "Je n'ai pas réussi à récupérer la photo. Réessaie.",
  "add.photoUploadFailed": "Enregistré dans {name}, mais la photo n'a pas été envoyée. Ton souvenir est en sécurité.",
  "add.photoPremiumTitle": "Les photos sont réservées à Premium",
  "add.photoPremiumBody": "Une photo au verso aide la mémoire visuelle : tu la vois seulement après avoir essayé de te souvenir. Avec Memika Premium, tu peux en joindre une à chaque souvenir.",
  "add.photoPremiumConfirm": "Découvrir Premium",
  "add.photoPremiumCancel": "Pas maintenant",
  "memory.photoA11y": "Photo du souvenir",
```

- [ ] **Step 4: `es.ts`**

```ts
  // ---- fotos de los recuerdos (B5, 2026-09-03) ----
  "add.photoAdd": "Añadir una foto",
  "add.photoChange": "Cambiar foto",
  "add.photoSheetTitle": "Foto en el reverso",
  "add.photoCamera": "Hacer una foto",
  "add.photoLibrary": "Elegir de la galería",
  "add.photoRemove": "Quitar foto",
  "add.photoPermissionDenied": "Sin permiso para la cámara no puedo hacer la foto. Puedes concederlo en los ajustes del teléfono.",
  "add.photoPickFailed": "No he podido obtener la foto. Inténtalo de nuevo.",
  "add.photoUploadFailed": "Guardado en {name}, pero la foto no se ha subido. Tu recuerdo está a salvo.",
  "add.photoPremiumTitle": "Las fotos son de Premium",
  "add.photoPremiumBody": "Una foto en el reverso ayuda a la memoria visual: la ves solo después de intentar recordar. Con Memika Premium puedes adjuntar una a cada recuerdo.",
  "add.photoPremiumConfirm": "Descubrir Premium",
  "add.photoPremiumCancel": "Ahora no",
  "memory.photoA11y": "Foto del recuerdo",
```

- [ ] **Step 5: Parità dei cataloghi, typecheck, commit**

Run: `npm test -- lib/i18n/i18n.test.ts && npm run lint`
Expected: PASS — stesse chiavi nei quattro cataloghi, `{name}` presente in tutte e quattro le `add.photoUploadFailed`.

```bash
git add lib/i18n/it.ts lib/i18n/en.ts lib/i18n/fr.ts lib/i18n/es.ts
git commit -m "$(cat <<'EOF'
feat(i18n): copy delle foto sui ricordi in quattro lingue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `MemoryPhoto` e `PhotoSheet`

**Files:**
- Create: `components/MemoryPhoto.tsx`
- Create: `components/PhotoSheet.tsx`

**Interfaces:**
- Consumes: `getPhotoUrl` (Task 4); `type PhotoSource` da `@/lib/photo-utils`; chiavi i18n del Task 5; `Tappable`, `GhostButton`, `tap`.
- Produces:
  - `<MemoryPhoto path?: string | null; localUri?: string | null; style?: StyleProp<ViewStyle> />`
  - `<PhotoSheet visible: boolean; hasPhoto: boolean; onPick: (source: PhotoSource) => void; onRemove: () => void; onClose: () => void; onDismissed?: () => void />`

- [ ] **Step 1: Scrivere `components/MemoryPhoto.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";

import { useT } from "@/lib/i18n";
import { getPhotoUrl } from "@/lib/photos";
import { reportError } from "@/lib/report-error";
import { useColors } from "@/theme/tokens";

type Props = {
  /** Chiave nel bucket (memories.photo_path). Risolta in URL firmato al render. */
  path?: string | null;
  /** file:// locale — l'anteprima in Add prima del caricamento. Vince su path. */
  localUri?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * La foto sul RETRO di un ricordo: larghezza piena, 4:3, angoli 12, cover,
 * al massimo 240 di altezza. Chi la monta decide QUANDO: nei ripassi solo
 * dentro il pannello rivelato, mai sul fronte (memoria visiva = àncora che
 * arriva DOPO il tentativo di ricordo). Senza URL — demo, errore di rete,
 * bucket irraggiungibile — non renderizza nulla: niente riquadri vuoti.
 */
export function MemoryPhoto({ path, localUri, style }: Props) {
  const colors = useColors();
  const { t } = useT();
  const [uri, setUri] = useState<string | null>(localUri ?? null);

  useEffect(() => {
    if (localUri) {
      setUri(localUri);
      return;
    }
    if (!path) {
      setUri(null);
      return;
    }
    let cancelled = false;
    getPhotoUrl(path)
      .then((u) => {
        if (!cancelled) setUri(u);
      })
      .catch((e) => {
        reportError("photo/signed-url", e);
        if (!cancelled) setUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, localUri]);

  if (!uri) return null;
  return (
    <View
      style={[
        {
          width: "100%",
          aspectRatio: 4 / 3,
          maxHeight: 240,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.divider,
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
        accessibilityLabel={t("memory.photoA11y")}
      />
    </View>
  );
}
```

- [ ] **Step 2: Scrivere `components/PhotoSheet.tsx`**

Stesso guscio di `components/FolderSortSheet.tsx:35-128` (backdrop e foglio FRATELLI: RN Pressable ignora `stopPropagation`; solo il backdrop chiude).

```tsx
import { Modal, Text, View } from "react-native";
import { Camera, Images, Trash2 } from "lucide-react-native";

import { GhostButton } from "@/components/GhostButton";
import { Tappable } from "@/components/Tappable";
import { tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";
import type { PhotoSource } from "@/lib/photo-utils";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  visible: boolean;
  /** Con una foto già scelta compare anche "Rimuovi foto". */
  hasPhoto: boolean;
  onPick: (source: PhotoSource) => void;
  onRemove: () => void;
  onClose: () => void;
  /** iOS: il Modal ha FINITO di chiudersi. Solo da qui si può presentare il picker. */
  onDismissed?: () => void;
};

/**
 * Foglio dal basso del "+" nel box del significato: Fotocamera / Libreria /
 * Rimuovi (spec §B5). Su iOS il picker NON si presenta finché questo Modal è
 * ancora sullo schermo: `setVisible(false)` non chiude in modo sincrono e la
 * chiusura è animata (~300 ms). Perciò il foglio espone `onDismissed`
 * (`Modal.onDismiss`, iOS-only, react-native/Libraries/Modal/Modal.d.ts:83) e
 * chi lo monta lancia il picker LÌ, non dentro onPick.
 */
export function PhotoSheet({
  visible,
  hasPhoto,
  onPick,
  onRemove,
  onClose,
  onDismissed,
}: Props) {
  const { t } = useT();
  const colors = useColors();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          pressedOpacity={1}
          containerStyle={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          style={{ flex: 1, backgroundColor: "rgba(15,27,51,0.32)" }}
        >
          <View />
        </Tappable>
        <View
          style={{
            backgroundColor: colors.warmWhite,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 32,
            shadowColor: "#0F1B33",
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: -8 },
            shadowRadius: 30,
            elevation: 24,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.switchTrackOff,
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 22,
              color: colors.navy,
              lineHeight: 26,
              letterSpacing: -0.4,
            }}
          >
            {t("add.photoSheetTitle")}
          </Text>

          <View style={{ marginTop: 14 }}>
            <Row
              icon={<Camera size={20} color={colors.navy} strokeWidth={1.9} />}
              label={t("add.photoCamera")}
              onPress={() => onPick("camera")}
            />
            <Row
              icon={<Images size={20} color={colors.navy} strokeWidth={1.9} />}
              label={t("add.photoLibrary")}
              onPress={() => onPick("library")}
            />
            {hasPhoto ? (
              <Row
                icon={<Trash2 size={20} color={colors.danger} strokeWidth={1.9} />}
                label={t("add.photoRemove")}
                danger
                onPress={onRemove}
              />
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <GhostButton label={t("common.cancel")} onPress={onClose} variant="link" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Tappable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 52,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: FONT.medium,
          fontSize: 15.5,
          color: danger ? colors.danger : colors.navy,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Tappable>
  );
}
```

- [ ] **Step 3: Typecheck e commit**

```bash
npm run lint
git add components/MemoryPhoto.tsx components/PhotoSheet.tsx
git commit -m "$(cat <<'EOF'
feat(ui): MemoryPhoto (foto sul retro, URL firmato) e PhotoSheet (fotocamera / libreria / rimuovi)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add — il `+` nel box del significato, gate Premium, upload al salvataggio

**Files:**
- Modify: `app/add.tsx` (import in cima; stato accanto agli altri `useState`; `doSave`; campo del significato; retro dell'anteprima; chiusura del JSX)
- Create **solo se B4 non è ancora a bordo** (vedi Step 1): `lib/plan.ts`, `lib/use-plan.ts`

**Interfaces:**
- Consumes: `pickPhoto`, `resizeForUpload`, `uploadMemoryPhoto`, `type PhotoSource` (Task 4); `MemoryPhoto`, `PhotoSheet` (Task 6); `MascotDialog` (`components/MascotDialog.tsx:10-18`); chiavi del Task 5; `createMemory` che già restituisce `Memory | null` (`lib/api.ts:432-466`).
- **Interfaccia prodotta da B4** (piano `2026-09-03-piani-paywall-revenuecat.md`, Task 1 e Task 6), che nell'ordine di esecuzione concordato gira **prima** di questo. Attenzione ai due moduli, sono distinti: `lib/plan.ts` esporta `type Plan = "free" | "pro" | "premium"` e `canUsePhotos(plan: Plan): boolean` (true SOLO per `premium`, spec :641) — è puro e non importa React; `lib/use-plan.ts` esporta l'hook `usePlan(): Plan`, che legge l'auth store e applica `effectivePlan()`. La rotta `/paywall` (root-level `app/paywall.tsx`) è di B4.

> **Attenzione a `app/add.tsx`:** quando questo task gira, il file è già stato
> modificato dal piano notifiche (Task 5) e da B4 (Task 8). Da lì arrivano già
> `import { MascotDialog } from "@/components/MascotDialog";`, `const plan =
> usePlan();` e `import { usePlan } from "@/lib/use-plan";`. **Non
> riscriverli:** un secondo `import { MascotDialog }` è `TS2300 Duplicate
> identifier` e un secondo `const plan` è `TS2451 Cannot redeclare
> block-scoped variable`. Gli step qui sotto lo dicono riga per riga.

- [ ] **Step 1: Assicurarsi dell'interfaccia di B4 — o degli stub**

```bash
ls lib/plan.ts lib/use-plan.ts app/paywall.tsx 2>&1
grep -n "export function canUsePhotos" lib/plan.ts 2>/dev/null
grep -n "export function usePlan" lib/use-plan.ts 2>/dev/null
```

Se le tre righe stampano i tre file e le due `grep` trovano le funzioni — è il caso normale, B4 è a bordo: **non creare niente**, vai allo Step 2.

Se invece `lib/plan.ts` NON esiste (stai eseguendo questo piano da solo, senza B4), crea i due file come STUB, che B4 sostituirà. `lib/plan.ts`:

```ts
/**
 * STUB in attesa di B4 (piani + paywall): la tabella vera dei limiti e la
 * mappa degli errcode arrivano con quel piano. Qui c'è solo ciò che serve
 * alle foto. B4 sostituisce questo file mantenendo lo stesso contratto:
 *   type Plan, canUsePhotos(plan).
 */
export type Plan = "free" | "pro" | "premium";

/** Le foto sui ricordi sono di Premium (spec 2026-09-02, tabella dei piani). */
export function canUsePhotos(plan: Plan): boolean {
  return plan === "premium";
}
```

e `lib/use-plan.ts`:

```ts
/**
 * STUB in attesa di B4: il piano non è ancora sull'utente (lib/auth-store.ts
 * AuthUser non ha `plan`). Ritorna "premium" così il "+" della foto è
 * provabile dai tester senza paywall. B4 sostituisce questo file con la
 * lettura vera dall'auth store, stesso contratto: usePlan(): Plan.
 */
import type { Plan } from "./plan";

export function usePlan(): Plan {
  return "premium";
}
```

Con gli stub il `MascotDialog` delle foto non compare mai e il `router.push("/paywall")` è irraggiungibile: `app/paywall.tsx` arriva con B4. Non creare una rotta segnaposto.

- [ ] **Step 2: Import e stato in `app/add.tsx`**

Import in cima al file. Le prime tre righe **modificano** righe già esistenti, le altre sono nuove:

```ts
// La riga `import { Redirect, useLocalSearchParams } from "expo-router";`
// guadagna `router` (serve al push verso /paywall):
import { Redirect, router, useLocalSearchParams } from "expo-router";
// Se una riga `from "lucide-react-native"` esiste già, aggiungi Camera e Plus
// alle sue graffe invece di aggiungere un secondo import dallo stesso modulo:
import { Camera, Plus } from "lucide-react-native";
// MascotDialog: SOLO se l'import non c'è già (il piano notifiche lo aggiunge).
// Verifica con: grep -n "components/MascotDialog" app/add.tsx
import { MascotDialog } from "@/components/MascotDialog";

import { MemoryPhoto } from "@/components/MemoryPhoto";
import { PhotoSheet } from "@/components/PhotoSheet";
import {
  pickPhoto,
  resizeForUpload,
  uploadMemoryPhoto,
  type PhotoSource,
} from "@/lib/photos";
import { canUsePhotos } from "@/lib/plan";
```

`Platform` è già importato da `react-native`: serve al ramo iOS del picker.

L'hook del piano vive in un modulo diverso. Se B4 è a bordo, `app/add.tsx` importa già `usePlan` da `@/lib/use-plan` (B4 Task 8 Step 3 aggiunge `import { usePlan } from "@/lib/use-plan";`): **non aggiungerlo una seconda volta**. Se invece hai creato gli stub allo Step 1, aggiungi ora:

```ts
import { usePlan } from "@/lib/use-plan";
```

Sotto `const { t } = useT();`, PRIMA dei return anticipati (regola degli hook), aggiungi:

```ts
  // Foto sul retro (Premium). Fino al salvataggio è solo un file locale, già
  // ridimensionato alla scelta: il CARICAMENTO parte dopo che la riga esiste,
  // perché il path contiene memory_id — e chi abbandona la schermata non
  // lascia file orfani nel bucket.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  // iOS: la sorgente scelta resta in attesa finché il foglio non ha FINITO di
  // chiudersi (vedi requestPick). Su Android è sempre null.
  const [pendingSource, setPendingSource] = useState<PhotoSource | null>(null);
  const [premiumAsk, setPremiumAsk] = useState(false);
```

`const plan = usePlan();` serve, ma con B4 a bordo **c'è già** (lo dichiara B4 Task 8 Step 3.2, accanto a `totalCount` e `planBlock`): riusalo. Aggiungilo qui solo se `grep -n "const plan = usePlan" app/add.tsx` non trova nulla.

- [ ] **Step 3: I gestori del foglio**

Subito dopo la definizione di `doSave` (dopo la riga 212, prima di `const handleBack`), aggiungi:

```ts
  const openPhotoSheet = () => {
    if (!canUsePhotos(plan)) {
      // Free/Pro: la mascotte spiega e propone l'upgrade (spec: "disabilita,
      // spiega, propone l'upgrade"), il bottone resta visibile.
      setPremiumAsk(true);
      return;
    }
    setPhotoSheetOpen(true);
  };

  const handlePickPhoto = async (source: PhotoSource) => {
    try {
      const outcome = await pickPhoto(source);
      if (outcome.status === "denied") {
        showToast(t("add.photoPermissionDenied"));
        return;
      }
      if (outcome.status !== "picked") return;
      // Ridimensiona SUBITO: l'anteprima mostra il file piccolo (un originale
      // da 12 MP decodificato costa ~48 MB, e <Image> lo decodifica intero
      // anche in un box da 240) e il salvataggio non ricodifica più niente.
      const jpeg = await resizeForUpload(outcome.uri);
      setPhotoUri(jpeg.uri);
    } catch (e) {
      reportError("add/photo-pick", e);
      showToast(t("add.photoPickFailed"));
    }
  };

  const requestPick = (source: PhotoSource) => {
    // Chiudere il foglio PRIMA di aprire il picker. `setPhotoSheetOpen(false)`
    // NON chiude il Modal in modo sincrono (l'animazione dura ~300 ms) e /add
    // è già presentato come modal su iOS (app/_layout.tsx:344): un picker
    // presentato sopra un Modal ancora vivo viene rifiutato da UIKit e non
    // compare mai. Su iOS quindi si aspetta onDismiss del Modal; su Android il
    // Modal è un Dialog e non c'è conflitto di presentazione.
    setPhotoSheetOpen(false);
    if (Platform.OS === "ios") setPendingSource(source);
    else void handlePickPhoto(source);
  };
```

- [ ] **Step 4: L'upload dentro `doSave` — tre innesti, non una riscrittura**

`doSave` è già stato riorganizzato due volte prima di questo task: il piano notifiche ci ha messo il pre-prompt del permesso (con un `return` anticipato e una `clearFields()` condivisa) e B4 il blocco del tetto di piano più la mappatura dell'errcode nel `catch`. **Riscrivere il `try` per intero cancellerebbe entrambi in silenzio** — `tsc` non se ne accorgerebbe, perché tutti i simboli restano dichiarati. Quindi qui si fanno tre innesti ancorati al testo.

Il corpo del `try`, quando questo task comincia, è:

```ts
    try {
      const saved = await createMemory({ /* … */ });
      setDailyCount((c) => (c ?? 0) + 1);
      setTotalCount((c) => (c ?? 0) + 1);
      showToast(t("add.savedToast", { name: folderRow.name }));
      if (saved && canOfferPrompt) {
        if (addAnother) clearFields();
        setCanOfferPrompt(false);
        setNotifPrompt({ memory: saved, addAnother });
        return;
      }
      if (saved) void scheduleFirstReview(saved);
      if (addAnother) {
        clearFields();
        termRef.current?.focus();
      } else {
        safeBack("/(app)/knowledge");
      }
    } catch (e) {
```

**Innesto A — il caricamento, subito dopo i due contatori.** Sotto `setTotalCount((c) => (c ?? 0) + 1);` (o, se B4 non è a bordo, sotto `setDailyCount((c) => (c ?? 0) + 1);`) e **prima** della riga `showToast(…)`, inserisci:

```ts
      // La foto si carica DOPO che la riga esiste. photoUri è già il JPEG
      // ridimensionato dalla scelta: qui si leggono solo i byte. Se il
      // caricamento fallisce la riga resta e si avvisa — perdere il testo per
      // colpa di una foto sarebbe il peggiore dei due esiti. In demo
      // createMemory è null: niente upload.
      let photoFailed = false;
      if (saved && photoUri) {
        try {
          await uploadMemoryPhoto(user.id, saved.id, photoUri);
        } catch (e) {
          reportError("add/photo-upload", e);
          photoFailed = true;
        }
      }
```

(La variabile del ricordo appena creato si chiama `saved`: è il nome che le ha dato il piano notifiche. Se stai eseguendo questo piano da solo e la riga è ancora `const created = await createMemory({…})` senza il resto, usa `created`.)

**Innesto B — il toast dice la verità.** Sostituisci la riga

```ts
      showToast(t("add.savedToast", { name: folderRow.name }));
```

con

```ts
      showToast(
        photoFailed
          ? t("add.photoUploadFailed", { name: folderRow.name })
          : t("add.savedToast", { name: folderRow.name }),
      );
```

**Innesto C — "Salva e aggiungi un altro" azzera anche la foto.** La foto è contenuto del ricordo, non contesto di sessione: se restasse, il salvataggio dopo la caricherebbe sotto un altro `memory_id`. `clearFields()` è definita poco sopra `doSave` (piano notifiche, Task 5 Step 3) ed è chiamata da entrambi i rami che riportano la schermata in bianco, quindi basta aggiungerci una riga:

```ts
  const clearFields = () => {
    setTerm("");
    setReading("");
    setDefinition("");
    setExample("");
    // La foto è contenuto del ricordo, non contesto di sessione: se restasse,
    // il salvataggio dopo la caricherebbe sotto un altro memory_id.
    setPhotoUri(null);
  };
```

Se `clearFields` non esiste (questo piano eseguito da solo), aggiungi `setPhotoUri(null);` accanto ai quattro `set…("")` dentro il ramo `if (addAnother) { … }` di `doSave`.

Il `} catch (e) {` e il `finally` **non si toccano**: la mappatura `planLimitFromCode(errorCode(e))` che apre il `catch` è di B4 e deve restare la prima cosa che succede lì dentro.

- [ ] **Step 5: Il box del significato con il `+`**

Sostituisci il `TextInput` del significato — quello con `ref={definitionRef}` e `placeholder={t("add.definitionPlaceholder")}`, unico nel file — con un `View` relativo che lo contiene. (Niente numeri di riga: notifiche e B4 hanno già aggiunto ~60 righe sopra questo punto.)

```tsx
            {/* Il "+" per la foto vive DENTRO il box del significato, in basso a
                destra (spec §B5): quel box È il retro della card, e la foto va
                sul retro. paddingBottom 44 tiene il testo sopra il bottone
                anche a tre righe; senza, scorrerebbe sotto. */}
            <View style={{ position: "relative" }}>
              <TextInput
                ref={definitionRef}
                value={definition}
                onChangeText={(t) => {
                  setDefinition(t);
                  if (missing === "definition") setMissing(null);
                }}
                placeholder={t("add.definitionPlaceholder")}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={t("add.definitionLabel")}
                multiline
                textAlignVertical="top"
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: missing === "definition" ? colors.danger : colors.hairline,
                  padding: 16,
                  paddingBottom: 44,
                  minHeight: 90,
                  fontFamily: FONT.regular,
                  fontSize: 16,
                  color: colors.navy,
                  lineHeight: 22,
                  letterSpacing: -0.07,
                }}
              />
              <Tappable
                onPress={openPhotoSheet}
                accessibilityRole="button"
                accessibilityLabel={photoUri ? t("add.photoChange") : t("add.photoAdd")}
                pressedOpacity={0.6}
                hitSlop={6}
                containerStyle={{ position: "absolute", right: 8, bottom: 8 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: photoUri ? colors.accent : colors.canvas,
                  borderWidth: photoUri ? 0 : 1,
                  borderColor: colors.hairline,
                }}
              >
                {photoUri ? (
                  <Camera size={18} color={colors.onAccent} strokeWidth={2} />
                ) : (
                  <Plus size={20} color={colors.navy} strokeWidth={2} />
                )}
              </Tappable>
            </View>
```

- [ ] **Step 6: L'anteprima sul RETRO della card**

Nel retro dell'anteprima, subito dopo il blocco `{example.trim() ? (…) : null}` e prima della chiusura del `View`, aggiungi:

```tsx
                {photoUri ? <MemoryPhoto localUri={photoUri} style={{ marginTop: 10 }} /> : null}
```

- [ ] **Step 7: Foglio e mascotte in fondo alla schermata**

Fra `</KeyboardAvoidingView>` e `</SafeAreaView>`, in fondo al JSX, aggiungi. Lì trovi già montati il `MascotDialog` del pre-prompt notifiche e il `PlanLimitDialog` di B4: **affiancali**, non sostituirli — sono tre dialoghi con `visible` mutuamente esclusivi.

```tsx
      <PhotoSheet
        visible={photoSheetOpen}
        hasPhoto={photoUri !== null}
        onPick={requestPick}
        onDismissed={() => {
          // iOS: il foglio è chiuso davvero, ora il picker può presentarsi.
          const source = pendingSource;
          setPendingSource(null);
          if (source) void handlePickPhoto(source);
        }}
        onRemove={() => {
          setPhotoUri(null);
          setPhotoSheetOpen(false);
        }}
        onClose={() => setPhotoSheetOpen(false)}
      />
      {/* Free/Pro: la mascotte spiega e manda al paywall (B4). Il Modal si
          chiude PRIMA del push, come settings.tsx:164-165 fa con lo stato. */}
      <MascotDialog
        visible={premiumAsk}
        title={t("add.photoPremiumTitle")}
        body={t("add.photoPremiumBody")}
        confirmLabel={t("add.photoPremiumConfirm")}
        cancelLabel={t("add.photoPremiumCancel")}
        onConfirm={() => {
          setPremiumAsk(false);
          router.push("/paywall" as never);
        }}
        onCancel={() => setPremiumAsk(false)}
      />
```

- [ ] **Step 8: Typecheck e commit**

```bash
npm run lint
git add app/add.tsx
# solo se allo Step 1 hai creato gli stub (senza B4 questi due file non esistono):
git add lib/plan.ts lib/use-plan.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(add): il "+" nel box del significato allega una foto al ricordo (Premium), caricata al salvataggio

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

Con B4 a bordo `lib/plan.ts` e `lib/use-plan.ts` non vengono toccati da questo task e il commit contiene il solo `app/add.tsx`.

---

### Task 8: Rendering — scheda del ricordo e pannelli di rivelazione

**Files:**
- Modify: `app/memory/[id].tsx` — import e card del significato (il piano notifiche ci ha già aggiunto un import, un `useEffect` e una guardia auth: ~15 righe in più, anchor testuali invariati)
- Modify: `app/review/scan.tsx:6-15` (import) e `:335-358` (pannello rivelato)
- Modify: `app/review/focus.tsx:6-16` (import) e `:136-172` (pannello rivelato)
- Modify: `app/review/reinforcement.tsx:7-16` (import) e `:193-217` (pannello risposta)

**Interfaces:**
- Consumes: `MemoryPhoto` (Task 6); `Memory.photoPath` e `ReviewCard.photoPath` (Task 3). Le carte arrivano già con `photoPath`: `loadDeckFor` (`lib/review-store.ts:369-432`) passa da `fetchDueMemoriesByLayer` (`select("*")`, `lib/api.ts:809-811`) → `mapMemory` → `toReviewCard`; la scheda passa da `fetchMemoryById` (`select("*")`, `lib/api.ts:389-396`). Nessun altro loader da toccare.

- [ ] **Step 1: Scheda del ricordo**

In `app/memory/[id].tsx`, aggiungi l'import accanto agli altri componenti:

```ts
import { MemoryPhoto } from "@/components/MemoryPhoto";
```

Dentro la card "Meaning + example", subito dopo il blocco `{memory.example ? (…) : null}` e prima di `</View>`, aggiungi:

```tsx
              {memory.photoPath ? <MemoryPhoto path={memory.photoPath} style={{ marginTop: 12 }} /> : null}
```

- [ ] **Step 2: Scan**

In `app/review/scan.tsx`, import (riga 6-11):

```ts
import { MemoryPhoto } from "@/components/MemoryPhoto";
```

Dentro il pannello `{revealed ? (…) : null}` (righe 335-358), dopo il `</Text>` del `{card.back}` (riga 356) e prima di `</View>`:

```tsx
            {card.photoPath ? <MemoryPhoto path={card.photoPath} style={{ marginTop: 14 }} /> : null}
```

- [ ] **Step 3: Focus**

In `app/review/focus.tsx`, import (riga 6-12):

```ts
import { MemoryPhoto } from "@/components/MemoryPhoto";
```

Dentro `{revealed ? (…) : null}` (righe 136-172), dopo il blocco `{card.example ? (…) : null}` (riga 170) e prima di `</View>`:

```tsx
            {card.photoPath ? <MemoryPhoto path={card.photoPath} style={{ marginTop: 14 }} /> : null}
```

- [ ] **Step 4: Reinforcement**

In `app/review/reinforcement.tsx`, import (riga 7-12):

```ts
import { MemoryPhoto } from "@/components/MemoryPhoto";
```

Dentro `{stage === "answer" ? (…) : null}` (righe 194-217), dopo il `</Text>` del `{card.back}` (riga 215) e prima di `</View>`:

```tsx
            {card.photoPath ? <MemoryPhoto path={card.photoPath} style={{ marginTop: 14 }} /> : null}
```

La fase `hint` (righe 163-191) NON riceve la foto: è un aiuto, non la risposta.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run lint
git add "app/memory/[id].tsx" app/review/scan.tsx app/review/focus.tsx app/review/reinforcement.tsx
git commit -m "$(cat <<'EOF'
feat(review): la foto compare sul retro — scheda ricordo e pannelli di rivelazione dei tre ripassi

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Riconciliazione degli oggetti orfani a ogni apertura

**Files:**
- Modify: `app/(app)/_layout.tsx` (blocco degli import; nuovo effetto in coda a quelli che dipendono da `userId`)

**Interfaces:**
- Consumes: `reconcilePhotos(userId)` (Task 4); `userId` e `reportError`, entrambi già in scope in quel file.

> Niente numeri di riga: il piano notifiche (Task 7 Step 2) ha già aggiunto a
> questo file un import e un effetto `useEffect` su `userId` (il riallineamento
> del promemoria giornaliero), quindi ogni riga sotto la riga 16 si è spostata.

- [ ] **Step 1: Aggiungere l'effetto**

Import, accanto a quello di `@/lib/api`:

```ts
import { reconcilePhotos } from "@/lib/photos";
```

In coda agli effetti che dipendono da `userId` — cioè dopo quello della richiesta di eliminazione (`fetchDeletionRequestedAt`) e dopo quello del promemoria giornaliero, se il piano notifiche è già a bordo — aggiungi:

```ts
  // Le purghe SQL (cestino 24h) non possono cancellare i FILE del bucket foto
  // (migration 20260903110000, commento in testa): il client riconcilia la
  // propria cartella una volta per utente a ogni mount del gruppo. Best
  // effort e in background: un errore di rete non blocca nulla.
  useEffect(() => {
    if (!userId) return;
    reconcilePhotos(userId).catch((err) => {
      reportError("app-layout/photo-reconcile", err);
    });
  }, [userId]);
```

- [ ] **Step 2: Typecheck e commit**

```bash
npm run lint
git add "app/(app)/_layout.tsx"
git commit -m "$(cat <<'EOF'
feat(photos): riconciliazione degli oggetti orfani del bucket a ogni apertura dell'app

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Nativo — VERIFICARE che `app.json` porti il plugin `expo-image-picker`

**Files:**
- Verify (normalmente **nessuna modifica**): `app.json`, array `expo.plugins`
- Modify **solo** nel caso di ripiego descritto allo Step 2: `app.json`

**Interfaces:**
- Consumes: la voce `["expo-image-picker", { photosPermission, cameraPermission, microphonePermission: false }]` e `android.blockedPermissions: ["android.permission.RECORD_AUDIO"]` scritte dal piano `2026-09-03-build3-config-nativa.md`, Task 2.
- Produces: `NSPhotoLibraryUsageDescription` e `NSCameraUsageDescription` in italiano (testi FINALI dalla memoria di agosto), nessuna `NSMicrophoneUsageDescription`, `android.permission.RECORD_AUDIO` bloccato nel manifest.

Perché serve una voce esplicita: senza, prebuild applica comunque il plugin (`@expo/prebuild-config` `legacyExpoPlugins`) con i testi INGLESI di default e aggiunge `RECORD_AUDIO`. La fonte del permesso è proprio il plugin legacy di `expo-image-picker`: applicato senza props chiama `withPermissions(['android.permission.RECORD_AUDIO'])` finché `microphonePermission !== false` (`node_modules/expo-image-picker/plugin/build/withImagePicker.js:34-42`). Passando `microphonePermission: false` quel ramo si salta e il permesso finisce in `blockedPermissions`, così nessun altro pacchetto può rimetterlo. (`expo-audio` è già configurato con `microphonePermission: false, recordAudioAndroid: false`: non è lui.) NON passare `cameraPermission: false`: bloccherebbe `android.permission.CAMERA`.

Perché è una VERIFICA e non una scrittura: `app.json` è un file solo e nella build 3 lo scrive il piano di configurazione nativa, che gira prima di questo. Aggiungere qui una seconda voce `expo-image-picker` la farebbe comparire due volte in `expo.plugins`, con il plugin applicato due volte in prebuild — e `lib/native-config.test.ts` non se ne accorgerebbe, perché il suo `pluginProps()` ferma la ricerca alla prima voce.

- [ ] **Step 1: Controllare che la voce ci sia già**

```bash
node -e "const p=require('./app.json').expo.plugins;const e=p.filter(x=>Array.isArray(x)&&x[0]==='expo-image-picker');console.log('voci expo-image-picker:',e.length);console.log(JSON.stringify(e,null,1));console.log('blockedPermissions:',JSON.stringify(require('./app.json').expo.android.blockedPermissions));"
```

Expected — **una sola** voce, con esattamente queste props, e `RECORD_AUDIO` fra i `blockedPermissions`:

```json
[
 [
  "expo-image-picker",
  {
   "photosPermission": "Memika legge le tue foto per allegarle ai ricordi.",
   "cameraPermission": "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
   "microphonePermission": false
  }
 ]
]
```

- `voci expo-image-picker: 1` con quelle props → **non toccare `app.json`**, salta allo Step 3.
- `voci expo-image-picker: 2` o più → è il duplicato che questo task esiste per evitare: cancella quelle in eccesso lasciandone una sola e vai allo Step 2.
- `voci expo-image-picker: 0` → il piano di configurazione nativa non è ancora stato eseguito (stai lanciando questo piano da solo). Aggiungi la voce in `app.json`, dopo la voce `expo-audio` e prima di `"expo-asset"`:

```json
      [
        "expo-image-picker",
        {
          "photosPermission": "Memika legge le tue foto per allegarle ai ricordi.",
          "cameraPermission": "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
          "microphonePermission": false
        }
      ],
```

e, se `blockedPermissions` non esiste, aggiungilo dentro `expo.android`:

```json
      "blockedPermissions": ["android.permission.RECORD_AUDIO"],
```

- [ ] **Step 2: Verificare la config risolta (pre-build sanity, AGENTS.md §8)**

Run:
```bash
npx expo config --type introspect --json > "$TEMP/memika-introspect.json"
node -e "const c=require(process.env.TEMP+'/memika-introspect.json');const p=c.ios.infoPlist;console.log('photos:',p.NSPhotoLibraryUsageDescription);console.log('camera:',p.NSCameraUsageDescription);console.log('mic:',p.NSMicrophoneUsageDescription);const perms=(((c._internal||{}).modResults||{}).android||{}).manifest;console.log('android manifest permessi:',JSON.stringify((((perms||{}).manifest||{})['uses-permission']||[]).map(x=>x.$)));"
npx expo-doctor
```

Expected: `photos:` e `camera:` = i due testi italiani; `mic: undefined`; nel manifest `android.permission.RECORD_AUDIO` compare **solo** con `"tools:node": "remove"`; `expo-doctor` senza errori nuovi. Se `RECORD_AUDIO` compare senza `tools:node`, `microphonePermission: false` non è arrivato al plugin: ricontrolla di aver messo la voce in forma di array `["expo-image-picker", { … }]` e non come stringa.

Se `scripts/native-config/check-introspect.cjs` esiste (lo crea il piano di configurazione nativa), lancialo al posto della `node -e` qui sopra — copre gli stessi controlli e altri sette:

```bash
node scripts/native-config/check-introspect.cjs "$TEMP/memika-introspect.json"
```

- [ ] **Step 3: Commit — solo se `app.json` è davvero cambiato**

```bash
git status --short app.json
```

Se la riga è vuota, `app.json` era già corretto: **non c'è niente da committare**, questo task è chiuso e il fingerprint non cambia per causa sua. Altrimenti:

```bash
git add app.json
git commit -m "$(cat <<'EOF'
chore(native): plugin expo-image-picker con i testi italiani dei permessi, niente microfono

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

Quel commit cambierebbe il fingerprint: viaggia nella build 3 insieme a F1/F3/B4. Niente OTA da qui.

---

### Task 11: Documentazione — bucket, policy, cancellazione, regola dura

**Files:**
- Modify: `docs/DATA-MODEL.md` (tabella `memories`; tabella RLS; frase su `delete_own_account` e lo Storage; nuova sezione prima di "Common queries"; lista delle omissioni)
- Modify: `AGENTS.md` (dopo la regola sul `service_role`, § 3)
- Modify: `docs/ARCHITECTURE.md` (riga della tabella "Backend"), `README.md` (riga della tabella "Auth & DB")

> **Niente numeri di riga per `docs/DATA-MODEL.md` e `AGENTS.md`.** I due piani
> che girano prima (notifiche e B4) hanno già riscritto la tabella `profiles`
> (+3 colonne di piano), la tabella dei trigger (+3 righe), quella delle
> funzioni (+1) e ci hanno aggiunto una sezione "Errcode dei limiti"; in
> `AGENTS.md` B4 ha riscritto il paragrafo freemium e aggiunto tre regole dure.
> Ogni edit qui sotto cita il testo di ancoraggio: cercalo con `grep`.

- [ ] **Step 1: `docs/DATA-MODEL.md`**

Nella tabella `memories`, sotto la riga `notes`, aggiungi:

```markdown
| `photo_path` | text | null | Chiave dell'oggetto nel bucket privato `memory-photos` (`<user_id>/<memory_id>.jpg`, migration 20260903110000). null = nessuna foto. Mai un URL: si legge con URL firmati (`lib/photos.ts`). Premium **solo lato client** (`canUsePhotos`): nessun trigger controlla questa colonna: i trigger di `20260903100000_plans.sql` guardano ricordi, cartelle e sezioni, non `photo_path`. Un gate server è una decisione aperta. |
```

Nella tabella RLS (quella con una riga per tabella e le colonne read/write), aggiungi in fondo:

```markdown
| `storage.objects` (bucket `memory-photos`) | own folder `<auth.uid()>/…` | own folder: insert / update (upsert) / delete — `authenticated` only, no admin bypass |
```

Attenzione al confine di frase: la riga che comincia con `that explicit grant.` CHIUDE il periodo iniziato due righe sopra (il revoke ad `anon`). Tieni quelle tre parole e sostituisci solo da `No Storage bucket exists yet;` fino alla fine di quel paragrafo, così resta:

```markdown
`anon`/`authenticated`/`service_role`, and `revoke … from public` does not undo
that explicit grant. The photo bucket exists since 20260903110000, and this
function deliberately does NOT touch `storage.objects`: see § Storage below for
why SQL cannot delete files.
```

Prima di `## Common queries`, aggiungi la sezione:

```markdown
## Storage

### `memory-photos` (migration 20260903110000)

Private bucket (`public = false`), 5 MiB per object, `allowed_mime_types =
{image/jpeg}`. One object per memory at `<user_id>/<memory_id>.jpg`; the key
lives in `memories.photo_path`. Four policies on `storage.objects` for
`authenticated`, all bound to `(storage.foldername(name))[1] =
(select auth.uid()::text)`: `memory_photos_select_own`, `_insert_own`,
`_update_own` (the client uploads with `upsert: true`), `_delete_own`. No
admin bypass, no policy on `storage.buckets` (no SDK call needs one).

Reads use `createSignedUrl(path, 3600)` with an in-memory cache
(`lib/photo-utils.ts makeSignedUrlCache`), never `getPublicUrl`. All Storage
access goes through `lib/photos.ts`.

**Deleting files.** `delete from storage.objects` in SQL removes the metadata
row only — the S3 object stays (billed, unreachable), newer hosted projects
block the statement outright (`storage.protect_delete`, migration 0055), and
a missing row hides the file from `list()`/`remove()` forever. Therefore
`purge_trash()`, `purge_expired_accounts()` and `delete_own_account()` do
NOT touch `storage.objects`. Cleanup happens through the Storage API:

- **Memories purged from the trash** — the client reconciles its own folder
  on every `(app)` mount (`reconcilePhotos` in `lib/photos.ts`): `list(<uid>)`
  vs `select photo_path from memories where user_id = <uid>` (trash INCLUDED,
  a trashed memory can be restored), `remove()` of what has no row. Objects
  younger than 10 minutes are skipped (an upload may be in flight).
- **Purged accounts (72 h)** — no client is left to reconcile. Their files
  stay orphaned until a `service_role` job exists (an Edge Function on a
  schedule listing the bucket's top-level folders and removing those with no
  `profiles` row). **Open decision** — GDPR-relevant, owner's call (AGENTS.md
  §7). Photos are NOT removed at deletion-request time: a user who recovers
  the account within 72 h would lose them.
```

Nella lista "What's deliberately not modeled yet", sostituisci la riga `Multimedia memories — photos, audio. Defer until we know we want them.` con:

```markdown
- **Audio on memories** — photos landed with 20260903110000 (one per memory, Premium); audio is still deferred.
```

- [ ] **Step 2: `AGENTS.md` — la regola dura**

Nella sezione 3, subito dopo il punto che comincia con `- **The \`service_role\` Supabase key has not been wired into this repo`, aggiungi:

```markdown
- **The `memory-photos` bucket is private and stays private.** Never set
  `public = true`, never call `getPublicUrl`: photos are read through signed
  URLs only. `lib/photos.ts` is the single Storage access point (tables stay
  in `lib/api.ts`). Never `delete from storage.objects` in SQL — it orphans
  the file and hides it from the API; file cleanup is `remove()` via the
  Storage API (`docs/DATA-MODEL.md` § Storage).
```

- [ ] **Step 3: `docs/ARCHITECTURE.md` e `README.md`**

In `docs/ARCHITECTURE.md`, la riga della tabella che comincia con `| Backend | Supabase` diventa:

```markdown
| Backend | Supabase — Auth + Postgres (eu-central-1) + Storage (private bucket `memory-photos`) + one Edge Function (`revenuecat-sync`) |
```

In `README.md`, la riga che comincia con `| Auth & DB | Supabase`:

```markdown
| Auth & DB | Supabase — Auth + Postgres (EU, Frankfurt) + Storage (private `memory-photos` bucket) + Edge Function `revenuecat-sync` |
```

- [ ] **Step 4: Commit**

```bash
git add docs/DATA-MODEL.md AGENTS.md docs/ARCHITECTURE.md README.md
git commit -m "$(cat <<'EOF'
docs(data-model): bucket memory-photos, policy per utente e la verita' sulla cancellazione dei file

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Verifica finale sul dispositivo

Automatizzare questo non ha senso: servono un telefono, il bucket vero e la build 3 (il plugin del picker non arriva in OTA). In demo mode il `+` apre il foglio ma nulla viene caricato: la verifica è solo con un account vero, migrazione applicata.

1. **Permessi.** Apri Aggiungi, tocca il `+` nel box del significato → Fotocamera. Il prompt iOS deve dire *"Memika usa la fotocamera per allegare immagini ai tuoi ricordi."* Nega: toast `add.photoPermissionDenied`, nessun crash. Riapri → Libreria: nessun prompt (PHPicker / Photo Picker).
1b. **Il picker si apre al PRIMO tocco, su iOS.** Fotocamera e Libreria devono comparire subito dopo che il foglio si chiude, non al secondo tentativo e non "mai" (è il caso in cui il picker viene presentato sopra il `Modal` ancora vivo: `requestPick` aspetta `onDismiss`). Ripeti due volte di fila: apri il foglio, scegli Libreria, annulla, riapri, scegli Fotocamera.
2. **Anteprima sul retro.** Scelta la foto, il `+` diventa la fotocamera su sfondo accent e la foto compare nella card di anteprima SOTTO il retro, mai sul fronte. Scrivi tre righe di significato: il testo non passa mai sotto il bottone.
3. **Salvataggio.** "Salva e continua": in DB `photo_path = '<uid>/<memory_id>.jpg'`; nel bucket l'oggetto esiste, `image/jpeg`, poche centinaia di KB (una foto da 12 MP deve scendere a ≤ 1600 px di lato lungo). Una foto HEIC dalla libreria iOS arriva comunque come JPEG.
4. **Salva e aggiungi un altro.** Dopo il salvataggio la foto scelta sparisce con il testo; il secondo ricordo nasce senza foto.
5. **Fallimento onesto.** Modalità aereo DOPO aver scelto la foto, poi salva: `createMemory` fallisce → toast `add.saveFailed`, niente riga. Con rete ma bucket irraggiungibile (o migrazione non applicata) la riga si salva e il toast è `add.photoUploadFailed`: il testo non si perde mai per colpa della foto.
6. **Scheda del ricordo.** Apri il ricordo dalla cartella: la foto è dentro la card "Significato", 4:3, angoli 12, al massimo 240 di altezza.
7. **Ripassi.** Porta il ricordo in coda (`update memories set next_review_at = now(), review_window_end = now() + interval '1 day' where id = …`). In Focus la foto compare SOLO dopo "Mostra la risposta"; in Reinforcement solo nella fase risposta, non nel suggerimento; in Scan solo nel pannello rivelato. Cambia carta e torna: la stessa foto non si riscarica (URL in cache).
8. **Gate Premium** (solo con B4 a bordo): con `profiles.plan = 'free'` il `+` apre la mascotte con "Le foto sono di Premium" → "Scopri Premium" porta al paywall; "Non ora" chiude e basta.
9. **Riconciliazione.** Elimina il ricordo con la foto (cestino), aspetta la purga (o esegui `select public.purge_trash()` dopo aver retrodatato `deleted_at` di 25 ore). Riapri l'app: nel bucket l'oggetto non c'è più. Con il ricordo ancora nel cestino l'oggetto DEVE restare.
10. **Privacy.** Copia l'URL firmato di una foto e aprilo dopo un'ora: 400/403. Prova `https://<ref>.supabase.co/storage/v1/object/public/memory-photos/<path>`: 400 — il bucket non è pubblico.

**Da dire a Maurizio:** le foto sono Premium; nella fase di test lo stub di `lib/plan.ts` (se B4 non è ancora arrivato) le rende disponibili a tutti — è voluto, così si provano.

---

## Passi umani aperti

1. **`npx supabase db push`** della migrazione `20260903110000_memory_photos.sql` sul progetto `taekvxxljtgzsjrlmumo`, insieme a quella di B4, prima della build 3 — poi le tre query di verifica del Task 1, Step 3. Il client tollera la colonna assente, ma senza bucket ogni upload fallisce con il toast onesto.
2. **B4 prima di B5** (spec §"Ordine di esecuzione", riga 9 della tabella): `lib/plan.ts` con `Plan` / `canUsePhotos`, `lib/use-plan.ts` con l'hook `usePlan()`, `AuthUser.plan`, la rotta `/paywall`. Se B5 viene eseguito prima, restano gli stub del Task 7 (tutti Premium) e il push al paywall è irraggiungibile. **Prima di lanciare la build 3, verificare che `lib/plan.ts` e `lib/use-plan.ts` siano quelli di B4 e che `app/paywall.tsx` esista** — `grep -n "return \"premium\"" lib/use-plan.ts` non deve trovare nulla: una build 3 con gli stub spedisce le foto a tutti, senza gate client e (finché il punto 3 non è fatto) nemmeno server-side. È accettabile solo come scelta dichiarata per la fase di test ("Da dire a Maurizio" qui sopra), non come svista.
3. **Gate server-side sul `photo_path`** — ramo da aggiungere al trigger dei piani di B4 (`BEFORE INSERT OR UPDATE` su memories: `new.photo_path is not null and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path) and <piano> <> 'premium'` → errcode dedicato). Senza, il gate è solo cosmetico: chi conosce la REST API può scrivere `photo_path` da free.
4. **Foto degli account purgati** — decisione GDPR di Angelo/Maurizio: Edge Function con `service_role` (piano separato) oppure accettare gli orfani. Oggi restano orfani, documentato in `docs/DATA-MODEL.md` § Storage.
5. **Build 3** (`eas build --profile production`) con F1 + F3 + B4 + B5 + icona v2 + Sentry, dopo il pre-build sanity di AGENTS.md §8 (`expo config --type introspect`, `expo-doctor`, Hermes compile check).
6. **Coach tip "Allega una foto"** (memoria `photo_upload_feature`, punto 7, con la copy e la citazione a Paivio già scritte): **non implementato qui**, e non perché la decisione sia superata — perché nessuna schermata monta più `CoachTip` (verificato: `grep -rn CoachTip app/` = 0; solo `components/CoachTip.tsx` e il commento in `components/MascotDialog.tsx:22` "CoachTip è morto da tempo"). Un tip in un pool che nessuno legge non si vedrebbe. Decisione di Angelo: se i coach tip tornano vivi, il tip va aggiunto al pool `add` in `lib/coach-tips.ts` (una riga `defineTip("add.photo", …)`, sul modello delle righe 26-40) insieme a 3 chiavi × 4 lingue e al componente che lo mostra.

## Rischi e confini

- **Timeout 15 s** (`lib/network.ts:14`): l'upload passa dal fetch dell'app e non può escludersi. Una foto ridimensionata pesa 200-500 KB e ci sta anche su 3G; se i tester segnalano fallimenti su reti lente, la leva è `PHOTO_MAX_EDGE` 1280 / qualità 0.7, non un client Storage separato.
- **La riconciliazione è l'unica operazione distruttiva del piano** e lavora per differenza fra due liste. Per questo entrambe si paginano: `fetchPhotoPaths` con `range` + `order("id")` (PostgREST tronca a `max_rows = 1000`, `supabase/config.toml:18`, **senza errore**) e il `list()` del bucket con `offset` (`SearchOptions.limit` ha default 100). Una lista troncata da una delle due parti trasforma foto vive in orfani e le cancella a ogni apertura dell'app. Chi tocca quelle funzioni tiene la paginazione: senza modifica della foto dopo il salvataggio (fuori scope), un file cancellato per sbaglio non si può riattaccare.
- **File temporanei**: picker e manipulator scrivono nella cache dell'app (`<cache>/ImagePicker/*`, `<cache>/ImageManipulator/*.jpg`) che l'OS può svuotare. Con il ridimensionamento alla scelta, il JPEG piccolo nasce anche per una foto poi scartata (l'utente cambia idea, o abbandona Add): sono ~300 KB a colpo. Non li cancelliamo (servirebbe `expo-file-system` come dipendenza esplicita): la cache si pulisce da sola. Da rivalutare se cresce.
- **EXIF/GPS**: la ricodifica JPEG del manipulator con ogni probabilità scarta i metadati, ma i typings non lo dicono. Verificarlo una volta sul dispositivo (scarica l'oggetto dal bucket e controlla l'EXIF): bucket privato o no, meglio che le coordinate non viaggino.
- **Nessun controllo post-salvataggio**: un upload fallito non si ritenta se non ricreando il ricordo. Accettato per non allargare lo scope; `removeMemoryPhoto` e `uploadMemoryPhoto` sono già l'API per il controllo futuro nella scheda del ricordo.
- **Android low-RAM**: il sistema può uccidere `MainActivity` mentre la fotocamera è aperta; `ImagePicker.getPendingResultAsync()` recupera il risultato al ritorno. Non è cablato: se un tester lo segnala, si aggiunge in `app/add.tsx` in un `useEffect` al mount.
