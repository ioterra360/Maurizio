# Build 3 — configurazione nativa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare in `app.json` / `eas.json` / asset tutto ciò che SOLO una build nativa può spedire — plugin `expo-notifications` con icona bianca, plugin `expo-image-picker` con le frasi italiane, `userInterfaceStyle: "automatic"`, icona v2, permesso `BILLING` per RevenueCat, slot per DSN Sentry e chiavi RevenueCat — e scrivere la sequenza umana con cui la build 3 (vc13 / iOS 3) esce insieme alle migrazioni di B4/B5.

**Architecture:** Questo è il piano-ombrello del blocco nativo: cambia SOLO input del fingerprint (config, asset, env dei profili) e documentazione. Il codice delle funzionalità sta nei piani F3 (notifiche), B4 (piani + RevenueCat) e B5 (foto); quei piani lavorano sul branch `build-3` senza toccare `app.json`/`eas.json`, che sono di competenza di questo piano. Le verifiche sono tre: test vitest sui file di configurazione e sugli asset (invarianti che un umano non rileggerebbe), uno script che ispeziona la configurazione *risolta* (`npx expo config --type introspect`) prima dei 20 minuti di build EAS, e una checklist umana per ciò che richiede le chiavi di Angelo o i suoi account store.

**Tech Stack:** Expo SDK 54 (config plugin), EAS Build/Submit (eas-cli 22.4, versioni remote), expo-notifications 0.32.17, expo-image-picker 17.0.11, react-native-purchases 10.8.1, @sentry/react-native 7.2, vitest, sharp (solo una tantum, mai in `package.json`).

**Spec:** `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md` — §0 (righe 22-63), F1 §Meccanica (152-155: `userInterfaceStyle` è modifica nativa), F3 (355: plugin in `app.json`), B4 §RevenueCat (690-698), B5 §Stato attuale (732-735), *Ordine di esecuzione* (766-788: **una sola build** per F1+F3+B4+B5+icona v2+Sentry), *Rischi* (794-810). Decisioni finali anche in memoria: `session_handoff_2026-09-02.md` (RIPRESA), `ota_runtime_trap.md`, `sentry_activation_todo.md`, `ios_credentials_state_2026-08-29.md`.

## Global Constraints

- **Ordine rispetto agli altri tre piani della build 3, sullo stesso branch `build-3`:** `config-nativa Task 1-4` → `notifiche-locali` (tutto) → `piani-paywall-revenuecat` (tutto) → `foto-ricordi` (tutto) → `config-nativa Task 5` (attivazione) → `config-nativa Task 6` (gate umano). I Task 1-4 vanno **per primi** perché scrivono `app.json` ed `eas.json`, che gli altri tre piani danno per già fatti (il picker per le foto, gli slot RevenueCat per i piani, l'icona di notifica per F3). I Task 5 e 6 vanno **per ultimi** perché accendono un flag e lanciano una build che dipendono da tutti e tre.
- **Expo SDK 54 only.** Nessun bump di pacchetti. I quattro moduli nativi sono già installati dal commit `38904d6` (`package.json:26-29,42`): `expo-image-manipulator ~14.0.8`, `expo-image-picker ~17.0.11`, `expo-notifications ~0.32.17`, `react-native-purchases ^10.8.1`. Questo piano NON ne aggiunge altri.
- **Il fingerprint è per piattaforma** ed è l'hash di: `app.json` risolto, `eas.json`, `.gitignore` di root, i PNG referenziati (icon, adaptive-icon, splash), `package.json` → `scripts`, ogni dipendenza nativa (`docs/DEPLOY.md:144-151`). Ogni Task qui sotto lo cambia — è atteso: la build 3 è un runtime nuovo. **Nessun `eas update` da questo branch verso i binari in circolazione** (vc11/vc12/iOS 2): li raggiunge solo la ricetta di `docs/TROUBLESHOOTING.md:326-354` da `main`.
- **Nessuna voce nuova in `package.json` → `scripts`** (input del fingerprint, `packageJson:scripts`). Gli script vivono sotto `scripts/` e si lanciano con `node`.
- **TypeScript strict, niente `any`.** `npm run lint` = `tsc --noEmit` e include anche i test.
- **Test:** `npm test` = `vitest run`, raccoglie SOLO `features/**/*.test.ts` e `lib/**/*.test.ts` (`vitest.config.ts:9`), ambiente `node`. I test di configurazione stanno in `lib/native-config.test.ts` e leggono i file con `node:fs` da `process.cwd()` (vitest gira dalla root).
- **i18n:** `TKey = keyof typeof it`; `lib/i18n/i18n.test.ts` impone chiavi e segnaposto identici su it/en/fr/es. Il Task 5 tocca una chiave in tutti e quattro i cataloghi.
- **Segreti:** mai in git. `SENTRY_AUTH_TOKEN` solo via `eas env:create … --visibility secret`; `.env`, `.credentials/`, `credentials.json` sono gitignorati (`.gitignore:34,49-50`). Le chiavi `EXPO_PUBLIC_*` sono pubbliche e stanno in `eas.json` `env` (`docs/DEPLOY.md:136-140`).
- **Gli agenti NON lanciano `eas build` / `eas submit`** senza l'ok esplicito di Angelo (`AGENTS.md` §8). Il Task 6 è un gate umano.
- **Nessuna migrazione viene applicata a produzione automaticamente.** `npx supabase db push` va lanciato da un umano, da `memika-app` (l'unico albero collegato al progetto `taekvxxljtgzsjrlmumo`; il worktree `memika-build3` non è linkato e `db push` lì fallisce con "Cannot find project ref").
- **Lingua:** commenti, copy e documentazione in italiano come il resto del repo; simboli in inglese.
- **Non in questo piano** (decisioni non prese nella spec → non si inventano): ~~variante `dark` dello splash~~ — **FATTA fuori piano il 2026-09-03 su richiesta esplicita di Angelo** ("uniformiamo la schermata al tema in modo che non si veda il lampo bianco"): `dark: { backgroundColor: "#0E1015", image: "./assets/splash-icon.png" }`, stessa arte, fondo = `bgScreen` della palette scura; test in `lib/native-config.test.ts`; stringhe di permesso iOS in 4 lingue via `expo.locales` (la spec fissa due frasi italiane); il **pacchetto** `expo-system-ui` (non serve: `Appearance.getColorScheme()` legge `Configuration.uiMode` e segue il sistema da solo — senza il pacchetto resta chiara solo la finestra nativa sotto React, stesso motivo per cui lo splash in scuro è rinviato); l'aggiunta di `Updates.runtimeVersion` alla riga *Aggiornamento* di Impostazioni — la metà `Updates.updateId` è **già spedita** (`app/(app)/settings.tsx:444-448`, uscita il 2026-09-02), affiancarle il runtime servirebbe solo a confrontare a mano gli hash registrati in § "Build 3": decisione di Angelo, ed è JS (OTA).

---

## Chi possiede cosa

La build 3 è una sola, ma i piani sono quattro. Questa tabella evita che due piani tocchino lo stesso file o che un pezzo resti orfano.

| Pezzo | Piano |
|---|---|
| `app.json`: plugin `expo-notifications` (icona + colore), plugin `expo-image-picker` (frasi + `microphonePermission: false`), `userInterfaceStyle`, `blockedPermissions`, permesso `BILLING`, icona v2 | **questo** |
| `eas.json`: slot `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; `.env.example` | **questo** (i valori li mette Angelo, vedi checklist finale) |
| `assets/notification-icon.png` + sorgente | **questo** |
| Copy `settings.themeHint` (×4 lingue), commenti in `theme/theme-store.ts` e `tailwind.config.js`, `AGENTS.md` §6 | **questo** |
| `NOTIFICATIONS_ENABLED` → `true` | **questo, Task 5**, DOPO il merge di F3 (F3 costruisce la schermata lasciando il flag a `false`) |
| `PREMIUM_ENABLED`, `FREE_FOLDER_LIMIT`, `FOLDER_LIMIT_ENFORCED`, `SUBFOLDERS_MAX` (`lib/constants.ts:26,142,151,233`) | **B4**, insieme alla bonifica dei documenti che le descrivono come meccanismo vigente (`docs/PAYMENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DATA-MODEL.md`, `docs/app-store-listing.md`, `docs/store-listing.md`, `README.md`, `AGENTS.md` §1 — 15 occorrenze in 9 file, verificate il 2026-09-03 con `--exclude-dir=superpowers`; B4 le chiude fra il Task 9 Step 2, Step 2bis e Step 3). Questo piano NON le tocca: cancellarle qui lascerebbe quei documenti a citare simboli inesistenti, ed è la stessa trappola del rischio 7 della spec. Il Task 5 si limita a **verificare** che B4 abbia fatto entrambe le metà |
| Schermata `/notifications`, permesso dopo il primo ricordo, `scheduleNotificationAsync`, canali Android, `setNotificationHandler` | **F3** |
| `Purchases.configure` (dietro `isDemoMode` e dietro chiave vuota), paywall, edge function, migration `profiles.plan` + trigger + **seed dei tester dentro la migration** | **B4** |
| Bottone `+` in Add, bucket `memory-photos`, `memories.photo_path`, upload, migration B5 | **B5** |
| `eas build`, `eas submit`, upload Play, `db push` in produzione, `supabase functions deploy` della edge function di B4 + il suo segreto `sk_` | **umano (Angelo)**, Task 6 |

## Stato verificato il 2026-09-03 (branch `build-3` @ `38904d6`)

- `app.json` e `eas.json` sono identici a `main` (`git diff main -- app.json eas.json .gitignore` vuoto). Nessun plugin nuovo, `userInterfaceStyle: "light"` (`app.json:9`), `MODIFY_AUDIO_SETTINGS` dichiarato due volte (`app.json:34-37`), icona v1 (`app.json:7,28-31`).
- Anche senza voce in `app.json`, `npx expo config --type introspect` **già applica** i plugin di `expo-notifications` e `expo-image-picker` con opzioni vuote (prebuild li considera "legacy plugin"): oggi la config risolta ha `aps-environment: development`, `NSPhotoLibraryUsageDescription = "Allow $(PRODUCT_NAME) to access your photos"` in inglese, e `android.permission.RECORD_AUDIO` nel manifest (lo aggiunge il plugin del picker quando `microphonePermission !== false`, `node_modules/expo-image-picker/plugin/build/withImagePicker.js:34-36`). Il Task 2 sistema tutte e tre le cose.
- Nessuna icona di notifica esiste: senza, Android disegna il launcher icon come sagoma piatta nella status bar (`node_modules/expo-notifications/plugin/build/withNotifications.d.ts:3-9`: "96x96 all-white png with transparency").
- `react-native-purchases` **non ha** config plugin (nessun `app.plugin.js`): si autolinka. La sua doc chiede `com.android.vending.BILLING` nel manifest. iOS: la capability In-App Purchase è già sull'App ID (`DKCAUU78JN_IN_APP_PURCHASE`), non è un entitlement del profilo.
- Il profilo di provisioning locale `2JUGQ23636` porta già `aps-environment = production` ed è `ACTIVE`; l'App ID ha Push + IAP. **Non serve rigenerare nulla** e NON va impostato `mode: "production"` nel plugin notifiche (Xcode promuove l'entitlement in archive; `production` nel profilo `development` sarebbe la combinazione che Xcode rifiuta).
- Contatori EAS (`appVersionSource: "remote"`, `eas.json:4`; `autoIncrement: true`, `:27`): Android versionCode **12**, iOS buildNumber **2** → la prossima build production è **vc13 / iOS 3** senza modifiche in `app.json`. Una build fallita consuma il numero.
- Sentry: org **non creata**, nessun DSN da nessuna parte, nessun `SENTRY_AUTH_TOKEN` su EAS (`eas env:list` vuoto per i tre environment). RevenueCat: progetto non creato, nessuna chiave. Entrambi → slot vuoti + checklist.
- Le credenziali iOS locali (`.credentials/` + `credentials.json`) esistono SOLO in `memika-app`, non nel worktree. La chiave ASC è fuori dal repo in `Memika/builds/AuthKey_P54649SND2.p8` (`eas.json:47`).
- `npx expo-doctor` = 18/18 nel worktree; `git status` pulito (`assets/brand/mascot.png` era stato cancellato per sbaglio dal disco ed è stato ripristinato).
- Palette: accent chiaro `#1A2C4F` (`theme/palettes.ts:69`), accent scuro `#3B6BF5` (`:136`). **La tinta della notifica è quella scura, `#3B6BF5`**: il plugin scrive `notification_icon_color` in un solo `res/values/colors.xml` (`withNotificationIconColor` passa da `withAndroidColors`, `node_modules/expo-notifications/plugin/build/withNotificationsAndroid.js:48-56`), non esiste una variante `values-night`, e `#1A2C4F` su una tendina scura (superficie Material ≈ `#211F26`) sta a ~1.2:1, cioè invisibile — mentre `#3B6BF5` regge su entrambe (~4.6:1 su bianco, ~3.6:1 su `#211F26`). `colors.xml` è input NATIVO: sbagliarlo non si corregge via OTA, costa la build 4. Sfondo adattivo v2: `#F8D2C4` (`assets/brand/icon-v2/README.md:12`).
- **Il theme-store segue già l'OS senza altro codice:** `theme/theme-store.ts:31-37` `detectSystemScheme()` legge `Appearance.getColorScheme()`, `:39-41` risolve `"system"` con quello, `:99-107` un `Appearance.addChangeListener` a livello di modulo aggiorna lo scheme quando la preferenza è `"system"`. Con `userInterfaceStyle: "light"` iOS consegnava sempre chiaro; con `"automatic"` consegna il tratto reale. La sola cosa da cambiare lato JS è la copy dell'hint (Task 5) e due commenti di transizione (Task 2).

---

## File Structure

| File | Responsabilità |
|---|---|
| `assets/brand/icon-v2/notification-icon.source.mjs` **(nuovo)** | Sorgente vettoriale dell'icona di notifica (volto v2 in bianco), stessa convenzione di `brain-icon.source.mjs`. |
| `assets/notification-icon.png` **(nuovo)** | 96×96 RGBA, bianco su trasparente. Referenziato dal plugin. Input del fingerprint. |
| `assets/icon.png`, `assets/adaptive-icon.png` | Diventano copie byte-per-byte di `assets/brand/icon-v2/`. |
| `assets/brand/icon-v2/appstore-icon-1024.png` **(nuovo)** | La v2 **appiattita** a RGB (1024×1024, colorType 2): App Store Connect rifiuta il canale alpha e quel file non passa da nessuna pipeline. |
| `docs/store-assets/appstore-icon-1024.png`, `docs/store-assets/play-icon-512.png` | Copie v2 per gli upload manuali negli store (Apple = la versione appiattita, Play = la RGBA). |
| `app.json` | Plugin, permessi, tema, icona. |
| `eas.json` | Slot env per Sentry e RevenueCat nei profili `preview` e `production`. |
| `.env.example` | Documenta le due variabili RevenueCat. |
| `lib/native-config.test.ts` **(nuovo)** | Invarianti su `app.json`, `eas.json`, PNG. |
| `scripts/native-config/check-introspect.cjs` **(nuovo)** | Verifica la config RISOLTA (Info.plist, entitlements, manifest, colors). |
| `theme/theme-store.ts:6-11`, `tailwind.config.js:9-11` | Commenti di transizione da aggiornare. |
| `lib/i18n/{it,en,fr,es}.ts` | `settings.themeHint` dice la verità dopo la build 3 (Task 5, ancorato al testo: F3/B4/B5 hanno già aggiunto ~90 chiavi). |
| `lib/constants.ts` | `NOTIFICATIONS_ENABLED` → `true` (Task 5, ancorato al testo del commento riscritto da F3). |
| `AGENTS.md` § 6 (anti-pattern), § 8 (tabella strumenti) | Anti-pattern tema scuro rimosso; riga Sentry e pre-build aggiornate. |
| `docs/DEPLOY.md` | Sezione "Build 3", tabella brand, checklist, nuova baseline OTA. |
| `docs/TROUBLESHOOTING.md:326-354` | La ricetta checkout-dance è marcata storica. |
| `assets/brand/icon-v2/README.md` | Segna i passi eseguiti. |

---

### Task 1: Icona di notifica Android — bianca su trasparente

**Files:**
- Create: `assets/brand/icon-v2/notification-icon.source.mjs`
- Create: `assets/notification-icon.png` (generato dallo script)
- Create: `lib/native-config.test.ts`
- Modify: `assets/brand/icon-v2/README.md`

**Interfaces:**
- Consumes: la faccia della v2 in `assets/brand/icon-v2/brain-icon.source.mjs:50-60` (occhiali, occhio aperto con pupilla, occhio strizzato, sorriso) come riferimento visivo; `sharp` installato al volo con `--no-save`.
- Produces: `assets/notification-icon.png` — 96×96, colorType 6 (RGBA), path che il Task 2 mette in `app.json` → `["expo-notifications", { "icon": "./assets/notification-icon.png" }]`; la funzione locale `pngHeader(file)` in `lib/native-config.test.ts`, riusata dai test del Task 2.

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `lib/native-config.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- lib/native-config.test.ts`
Expected: FAIL — `ENOENT … assets/notification-icon.png`.

- [ ] **Step 3: Scrivere il sorgente dell'icona**

Crea `assets/brand/icon-v2/notification-icon.source.mjs`:

```js
// Icona di notifica Android per expo-notifications: 96×96, BIANCA su
// TRASPARENTE. Android nella status bar usa solo il canale alpha e la tinge
// col `color` del plugin, quindi la geometria deve reggere a 24dp: qui c'è
// il volto della v2 (brain-icon.source.mjs:50-60 — occhiali, occhio aperto
// con pupilla, occhio strizzato, sorriso) senza cervello né cartella.
//
// Uso — sharp NON è in package.json, si installa al volo e si toglie subito
// (npm prune rimuove ciò che non è nel lockfile, come per react-native-web
// in docs/TROUBLESHOOTING.md § Runtime version mismatch):
//   npm install --no-save sharp
//   node assets/brand/icon-v2/notification-icon.source.mjs
//   npm prune --legacy-peer-deps
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WHITE = "#FFFFFF";
const stroke = (d, w) =>
  `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Contenuto dentro 8..88 su entrambi gli assi (2dp di margine a 24dp).
const svg = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <!-- occhiali -->
  <circle cx="30" cy="38" r="15" fill="none" stroke="${WHITE}" stroke-width="7"/>
  <circle cx="66" cy="38" r="15" fill="none" stroke="${WHITE}" stroke-width="7"/>
  ${stroke("M 45 38 Q 48 32 51 38", 6)}
  ${stroke("M 15 36 L 8 33", 6)}
  ${stroke("M 81 36 L 88 33", 6)}
  <!-- occhio aperto con pupilla, occhio strizzato -->
  <circle cx="30" cy="39" r="6" fill="${WHITE}"/>
  ${stroke("M 59 39 Q 66 32 73 39", 6)}
  <!-- sorriso -->
  ${stroke("M 38 64 Q 48 74 58 64", 7)}
</svg>`;

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../notification-icon.png");
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("scritto", out);
```

- [ ] **Step 4: Generare il PNG e ripulire `node_modules`**

Run, dalla root del worktree:

```bash
npm install --no-save sharp
node assets/brand/icon-v2/notification-icon.source.mjs
npm prune --legacy-peer-deps
git status --short
```

Expected: `scritto …/assets/notification-icon.png`; `git status` mostra SOLO `?? assets/notification-icon.png`, `?? assets/brand/icon-v2/notification-icon.source.mjs`, `?? lib/native-config.test.ts` — **nessuna modifica** a `package.json` / `package-lock.json` (se compaiono, `git checkout -- package.json package-lock.json` e ripeti il prune).

Apri `assets/notification-icon.png` con un visualizzatore: su sfondo scuro deve leggersi il volto (occhiali, pupilla a sinistra, occhio strizzato a destra, sorriso).

- [ ] **Step 5: Eseguire il test e verificare che passi**

Run: `npm test -- lib/native-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Aggiornare il README dell'icona v2**

In `assets/brand/icon-v2/README.md`, aggiungi in fondo:

```markdown

## Icona di notifica (2026-09-03)

`notification-icon.source.mjs` → `assets/notification-icon.png` (96×96, bianca
su trasparente: Android usa solo l'alpha). Referenziata in app.json dal plugin
`expo-notifications` con `color` = accent **scuro** `#3B6BF5`: la tinta finisce
in un unico `res/values/colors.xml` (nessuna variante `values-night`), quindi
un solo valore deve leggersi sia sulla tendina chiara sia su quella scura — il
navy `#1A2C4F` su tendina scura è invisibile. Per rigenerarla vedi
l'intestazione dello script (sharp con `--no-save`, poi `npm prune`).
```

- [ ] **Step 7: Typecheck e commit**

```bash
npm run lint
git add assets/notification-icon.png assets/brand/icon-v2/notification-icon.source.mjs assets/brand/icon-v2/README.md lib/native-config.test.ts
git commit -F - <<'EOF'
feat(brand): icona di notifica Android bianca su trasparente, dal volto v2

96×96 RGBA generata da un sorgente SVG (sharp con --no-save, mai in
package.json). Senza, Android disegna il launcher icon come sagoma piatta
nella status bar. Test vitest sull'IHDR del PNG.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
```

---

### Task 2: `app.json` — plugin, permessi, tema automatico, icona v2

**Files:**
- Modify: `app.json` (tutto il file, riscritto sotto)
- Modify: `assets/icon.png`, `assets/adaptive-icon.png` (copie da `assets/brand/icon-v2/`)
- Create: `assets/brand/icon-v2/appstore-icon-1024.png` (la v2 appiattita a RGB)
- Modify: `docs/store-assets/appstore-icon-1024.png` (copia dell'appiattita), `docs/store-assets/play-icon-512.png` (copia v2)
- Modify: `lib/native-config.test.ts`
- Create: `scripts/native-config/check-introspect.cjs`
- Modify: `theme/theme-store.ts:6-11`, `tailwind.config.js:9-11`, `AGENTS.md` § 6 (anti-pattern "Light/dark mode toggle now"), `assets/brand/icon-v2/README.md`

**Interfaces:**
- Consumes: `assets/notification-icon.png` dal Task 1; `pngHeader` in `lib/native-config.test.ts`.
- Produces: la config nativa della build 3. In particolare per F3: plugin `expo-notifications` con `icon` e `color` (nessun `defaultChannel` — serve solo a FCM; i canali locali li crea F3 con `setNotificationChannelAsync`; nessun `sounds`); per B5: `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` italiane, `android.permission.CAMERA` disponibile (dal manifest del pacchetto), `RECORD_AUDIO` bloccato; per B4: `com.android.vending.BILLING`. Lo script `scripts/native-config/check-introspect.cjs <introspect.json>` esce 0 se la config risolta è quella attesa (riusato nel Task 6).

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungi in fondo a `lib/native-config.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- lib/native-config.test.ts`
Expected: FAIL — `userInterfaceStyle` è `"light"`, `pluginProps("expo-notifications")` è `undefined`, le copie non coincidono e `assets/brand/icon-v2/appstore-icon-1024.png` non esiste ancora (`ENOENT`).

- [ ] **Step 3: Copiare gli asset v2 e appiattire quello per App Store Connect**

`assets/icon.png` e `assets/adaptive-icon.png` sono copie semplici (passi 1-2 di `assets/brand/icon-v2/README.md:10-11`). I PNG v2 sono RGBA con alpha tutto a 255: la pipeline di prebuild (`@expo/prebuild-config` `withIosIcons` → `generateImageAsync({ removeTransparency: true, backgroundColor: '#ffffff' })`) li appiattisce a RGB da sola, quindi per `assets/icon.png` l'"Apple rejects alpha" di `docs/DEPLOY.md` § Brand assets è una convenzione sul sorgente, non un vincolo.

**`docs/store-assets/appstore-icon-1024.png` è il caso opposto.** Non passa da nessuna pipeline: è l'icona che si carica **a mano** nella scheda di App Store Connect, e lì l'alpha fa rifiutare l'upload (il file di oggi è infatti colorType 2, RGB). Va quindi appiattita, non copiata. Il risultato si committa accanto agli altri asset v2, così la copia in `docs/store-assets/` resta verificabile byte per byte e c'è una sorgente da ricaricare in futuro.

```bash
cp assets/brand/icon-v2/icon.png assets/icon.png
cp assets/brand/icon-v2/adaptive-icon.png assets/adaptive-icon.png
cp assets/brand/icon-v2/play-icon-512.png docs/store-assets/play-icon-512.png

npm install --no-save sharp
node -e "const sharp=require('sharp');sharp('assets/brand/icon-v2/icon.png').flatten({background:'#FFFFFF'}).png({palette:false}).toFile('assets/brand/icon-v2/appstore-icon-1024.png').then(()=>console.log('appstore-icon-1024.png: RGB opaco'))"
npm prune --legacy-peer-deps
cp assets/brand/icon-v2/appstore-icon-1024.png docs/store-assets/appstore-icon-1024.png

node -e "const b=require('node:fs').readFileSync('docs/store-assets/appstore-icon-1024.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20),'colorType='+b[25])"
git status --short
```

Expected: l'ultima `node -e` stampa `1024x1024 colorType=2`; `git status` non mostra modifiche a `package.json` / `package-lock.json` (se compaiono: `git checkout -- package.json package-lock.json` e ripeti il prune). `flatten` con sfondo bianco non altera un pixel — l'alpha della v2 è 255 ovunque, verificato — toglie solo il canale.

Lo splash (`assets/splash-icon.png`) resta v1: il README dell'icona non lo copre e la spec non lo nomina.

- [ ] **Step 4: Riscrivere `app.json`**

Sostituisci l'intero file con:

```json
{
  "expo": {
    "name": "Memika",
    "slug": "memika",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "memika",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "studio.tailor.memika",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "CFBundleDevelopmentRegion": "it",
        "CFBundleLocalizations": ["it", "en", "fr", "es"],
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": false,
          "NSExceptionDomains": {
            "localhost": { "NSExceptionAllowsInsecureHTTPLoads": true }
          }
        }
      }
    },
    "android": {
      "package": "studio.tailor.memika",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F8D2C4"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "com.android.vending.BILLING"
      ],
      "blockedPermissions": ["android.permission.RECORD_AUDIO"]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#F5F3EF",
          "image": "./assets/splash-icon.png",
          "imageWidth": 200
        }
      ],
      [
        "expo-audio",
        {
          "microphonePermission": false,
          "recordAudioAndroid": false
        }
      ],
      "expo-asset",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3B6BF5"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Memika legge le tue foto per allegarle ai ricordi.",
          "cameraPermission": "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
          "microphonePermission": false
        }
      ],
      [
        "@sentry/react-native/expo",
        {
          "url": "https://de.sentry.io/",
          "organization": "memika",
          "project": "memika-app"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "feda06bb-a5d4-4985-b897-eb4de1351de7"
      }
    },
    "owner": "ioterra",
    "runtimeVersion": {
      "policy": "fingerprint"
    },
    "updates": {
      "url": "https://u.expo.dev/feda06bb-a5d4-4985-b897-eb4de1351de7",
      "fallbackToCacheTimeout": 0,
      "checkAutomatically": "ON_LOAD"
    }
  }
}
```

Perché così, riga per riga:
- `userInterfaceStyle: "automatic"` — F1. Su iOS il plugin *unversioned* `expo-system-ui` (gira anche senza il pacchetto npm) scrive `UIUserInterfaceStyle = Automatic` in Info.plist (`node_modules/@expo/prebuild-config/build/plugins/unversioned/expo-system-ui/withIosUserInterfaceStyle.js`, mappa `automatic → "Automatic"`). Su Android lo stesso plugin non scrive nulla e stampa il warning «Install expo-system-ui in your project to enable this feature» (`withAndroidUserInterfaceStyle.js:16-18`, solo `WarningAggregator`) — **c'è già oggi con `"light"`**, quindi non è una regressione: `Appearance.getColorScheme()` legge `Configuration.uiMode` e segue comunque il sistema. Senza il pacchetto resta chiara solo la finestra nativa sotto React, lo stesso motivo per cui la variante `dark` dello splash è fuori piano.
- `permissions` — un solo `MODIFY_AUDIO_SETTINGS` (era doppio; `expo-audio` lo aggiunge comunque da sé) e `com.android.vending.BILLING` come chiede la doc di RevenueCat. Nessun `POST_NOTIFICATIONS`: lo dichiara il manifest di `expo-notifications`.
- `blockedPermissions: ["android.permission.RECORD_AUDIO"]` — `expo-audio` lo dichiara nel SUO manifest e `recordAudioAndroid: false` non lo toglie (tutti gli AAB spediti finora lo portano). `microphonePermission: false` del picker lo blocca già; la voce esplicita rende l'intenzione leggibile senza dover conoscere il plugin.
- `expo-notifications` — solo `icon` e `color`. La tinta è l'accent **scuro** `#3B6BF5`: il plugin scrive `notification_icon_color` in un unico `res/values/colors.xml` (nessuna `values-night`), quindi un solo valore deve reggere entrambe le tendine, e da questa build il tema scuro esiste davvero — `#1A2C4F` su tendina scura sta a ~1.2:1, cioè invisibile, e un `colors.xml` sbagliato si corregge solo con un'altra build nativa. Niente `mode` (vedi Stato verificato), niente `defaultChannel` (FCM), niente `sounds`.
- `expo-image-picker` — le due frasi decise nella spec; `cameraPermission` MAI `false` (bloccherebbe `android.permission.CAMERA`).
- Sentry — placeholder invariati finché Angelo non crea l'org (checklist finale). Se l'org finisce in regione US va **tolta** la chiave `url` (`docs/DEPLOY.md` § Sentry, punto "Values to fill in").

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- lib/native-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Scrivere lo script che verifica la config risolta**

I test guardano `app.json`; questo guarda quello che i plugin hanno DAVVERO scritto (Info.plist, entitlements, manifest, colors). È l'unico modo per scoprire un plugin che non gira prima dei 20 minuti di EAS.

Crea `scripts/native-config/check-introspect.cjs`:

```js
#!/usr/bin/env node
// Verifica la configurazione nativa RISOLTA della build 3.
//
// Uso:
//   npx expo config --type introspect --json > "$TMP/introspect.json"
//   node scripts/native-config/check-introspect.cjs "$TMP/introspect.json"
//
// Legge quello che i plugin hanno scritto (Info.plist, entitlements,
// manifest Android, colors), non app.json: se un plugin non gira o gira con
// le opzioni sbagliate lo si vede qui, in un minuto, e non in una build EAS
// fallita dopo venti. Esce 1 al primo controllo rosso.
//
// NON copre la scrittura dei PNG in res/drawable-*: quella è un
// withDangerousMod (expo-notifications/plugin/build/withNotificationsAndroid.js:39-46)
// e l'introspezione lo salta. L'asset è coperto dal test vitest sull'IHDR
// (lib/native-config.test.ts).
"use strict";
const fs = require("node:fs");

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/native-config/check-introspect.cjs <introspect.json>");
  process.exit(2);
}
const c = JSON.parse(fs.readFileSync(file, "utf8"));

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}`);
  if (!cond) failed += 1;
}

const infoPlist = c.ios?.infoPlist ?? {};
const entitlements = c.ios?.entitlements ?? {};
const manifest = c._internal?.modResults?.android?.manifest?.manifest ?? {};
const usesPermission = (manifest["uses-permission"] ?? []).map((p) => p.$ ?? {});
const metaData = (manifest.application?.[0]?.["meta-data"] ?? []).map((m) => m.$?.["android:name"]);
const colors = Object.fromEntries(
  (c._internal?.modResults?.android?.colors?.resources?.color ?? []).map((x) => [x.$?.name, x._]),
);
const has = (name) => usesPermission.some((p) => p["android:name"] === name && p["tools:node"] !== "remove");
const removed = (name) => usesPermission.some((p) => p["android:name"] === name && p["tools:node"] === "remove");

// F1 — tema
check('userInterfaceStyle "automatic"', c.userInterfaceStyle === "automatic");
check('Info.plist UIUserInterfaceStyle = "Automatic"', infoPlist.UIUserInterfaceStyle === "Automatic");

// B5 — expo-image-picker
check(
  "NSCameraUsageDescription in italiano",
  infoPlist.NSCameraUsageDescription === "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
);
check(
  "NSPhotoLibraryUsageDescription in italiano",
  infoPlist.NSPhotoLibraryUsageDescription === "Memika legge le tue foto per allegarle ai ricordi.",
);
check("nessuna NSMicrophoneUsageDescription", infoPlist.NSMicrophoneUsageDescription === undefined);
check("RECORD_AUDIO nel manifest solo come tools:node=remove", removed("android.permission.RECORD_AUDIO") && !has("android.permission.RECORD_AUDIO"));
check("CAMERA non bloccato", !removed("android.permission.CAMERA"));

// F3 — expo-notifications
check("aps-environment nelle entitlements", typeof entitlements["aps-environment"] === "string");
check("meta-data icona di notifica", metaData.includes("expo.modules.notifications.default_notification_icon"));
check("meta-data colore di notifica", metaData.includes("expo.modules.notifications.default_notification_color"));
check("notification_icon_color = #3B6BF5", String(colors.notification_icon_color ?? "").toUpperCase() === "#3B6BF5");

// B4 — RevenueCat
check("com.android.vending.BILLING dichiarato", has("com.android.vending.BILLING"));

// Icona v2
check("iconBackground = #F8D2C4", String(colors.iconBackground ?? "").toUpperCase() === "#F8D2C4");

// Le OPZIONI risolte dei plugin — NON `_internal.pluginHistory`: prebuild
// applica i plugin "unversioned" di expo-notifications e expo-image-picker
// anche senza voce in app.json (con opzioni vuote: è esattamente il bug che
// stiamo chiudendo), quindi `p in pluginHistory` è già vero oggi e non
// verificherebbe niente.
const entry = (name) => (c.plugins ?? []).find((p) => Array.isArray(p) && p[0] === name);
check(
  "expo-notifications con icon e color",
  entry("expo-notifications")?.[1]?.icon === "./assets/notification-icon.png" &&
    entry("expo-notifications")?.[1]?.color === "#3B6BF5",
);
check(
  "expo-image-picker con microphonePermission false",
  entry("expo-image-picker")?.[1]?.microphonePermission === false,
);
check("expo-splash-screen con la sua immagine", entry("expo-splash-screen")?.[1]?.image === "./assets/splash-icon.png");
check("expo-audio senza microfono", entry("expo-audio")?.[1]?.microphonePermission === false);

// Sentry: il token non deve MAI stare nel plugin (docs/DEPLOY.md § Sentry)
const sentry = entry("@sentry/react-native/expo");
check("nessun authToken nel plugin Sentry", !(sentry && sentry[1] && "authToken" in sentry[1]));

console.log(failed === 0 ? "\nTutto verde." : `\n${failed} controlli falliti.`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 7: Eseguire l'introspezione e lo script**

```bash
TMP="$LOCALAPPDATA/Temp/memika-build3"; mkdir -p "$TMP"
npx expo config --type introspect --json > "$TMP/introspect.json"
node scripts/native-config/check-introspect.cjs "$TMP/introspect.json"
```

Expected: tutte le righe `OK`, `Tutto verde.`, exit 0. Se `RECORD_AUDIO` compare senza `tools:node=remove`, il plugin del picker non ha ricevuto `microphonePermission: false` (voce mal formata in `app.json`).

`npx expo config` stampa su stderr il warning `userInterfaceStyle: Install expo-system-ui in your project to enable this feature.`: **non fermarti**, c'è già oggi con `"light"` (lo emette il plugin unversioned per qualunque valore non vuoto) e non incide sul comportamento — vedi la motivazione dello Step 4. Il `> "$TMP/introspect.json"` cattura solo stdout, quindi il JSON resta valido.

- [ ] **Step 8: Aggiornare i commenti di transizione e AGENTS.md**

`theme/theme-store.ts`, sostituisci le righe 6-11 (da `* "Default" segue il telefono. NOTA transizione:` a `* altri cambi di codice.`) con:

```ts
 * "Default" segue il telefono: dalla build 3 app.json porta
 * userInterfaceStyle "automatic", l'OS consegna il tratto reale e lo store
 * lo risolve qui sotto senza altro codice. (Fino alla build 2 era "light"
 * di proposito — input del fingerprint — e Default valeva sempre chiaro.)
```

`tailwind.config.js`, sostituisci le righe 9-11 con:

```js
  // Tema deciso da theme/theme-store.ts via colorScheme.set(): dalla build 3
  // (userInterfaceStyle "automatic") segue davvero il sistema.
```

`AGENTS.md`, sostituisci le righe 246-247 (`- **Light/dark mode toggle now.** …` e la riga seguente) con:

```markdown
- **Static light-only styling.** Light AND dark ship since 2026-09-02
  (`theme/theme-store.ts`, `theme/palettes.ts`; `userInterfaceStyle` is
  `automatic` from build 3). Never read `colors` from `@/theme/tokens` at
  module scope — call `useColors()` / `useThemeTokens()` inside the render.
```

`assets/brand/icon-v2/README.md`, sotto la riga 13 (`4. caricare play-icon-512.png…`) aggiungi:

````markdown

**Passi 1-3 eseguiti il 2026-09-03** (piano
`docs/superpowers/plans/2026-09-03-build3-config-nativa.md`, Task 2); le
copie per gli store sono in `docs/store-assets/`. Il passo 4 resta manuale
in Play Console al momento dell'upload di vc13.

`appstore-icon-1024.png` è `icon.png` **appiattita a RGB** (App Store Connect
rifiuta il canale alpha e quel file si carica a mano, non passa da prebuild).
Per rigenerarla:

```bash
npm install --no-save sharp
node -e "const sharp=require('sharp');sharp('assets/brand/icon-v2/icon.png').flatten({background:'#FFFFFF'}).png({palette:false}).toFile('assets/brand/icon-v2/appstore-icon-1024.png')"
npm prune --legacy-peer-deps
```
````

- [ ] **Step 9: Test, typecheck, doctor, commit**

```bash
npm test
npm run lint
npx expo-doctor
git add app.json assets/icon.png assets/adaptive-icon.png assets/brand/icon-v2/appstore-icon-1024.png docs/store-assets/appstore-icon-1024.png docs/store-assets/play-icon-512.png lib/native-config.test.ts scripts/native-config/check-introspect.cjs theme/theme-store.ts tailwind.config.js AGENTS.md assets/brand/icon-v2/README.md
git commit -F - <<'EOF'
feat(native): app.json della build 3 — notifiche, image picker, tema automatico, icona v2

Plugin expo-notifications (icona bianca + tinta #3B6BF5, l'accent scuro: la
tinta finisce in un unico colors.xml e deve leggersi anche sulla tendina
scura) ed expo-image-picker (frasi italiane, microfono escluso),
userInterfaceStyle "automatic", RECORD_AUDIO bloccato (expo-audio lo
dichiarava nel suo manifest), com.android.vending.BILLING per RevenueCat,
MODIFY_AUDIO_SETTINGS una volta sola, icona v2 montata byte per byte su
sfondo #F8D2C4 e appiattita a RGB per la scheda App Store. Script
scripts/native-config/check-introspect.cjs verifica la config risolta.
Cambia il fingerprint su entrambe le piattaforme: solo build 3, mai OTA.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
```

Expected: `expo-doctor` 18/18, test e lint verdi.

---

### Task 3: `eas.json` — slot per Sentry e RevenueCat

**Files:**
- Modify: `eas.json:16-37` (profili `preview` e `production`)
- Modify: `.env.example` (in fondo)
- Modify: `lib/native-config.test.ts`

**Interfaces:**
- Produces: nei profili `preview` e `production`, le chiavi `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` con valore `""`. **B4** le legge con `process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ""` / `…_ANDROID_KEY` e deve trattare la stringa vuota come "SDK non configurato → utente Free, nessuna chiamata a `Purchases`" (oltre al ramo `isDemoMode`). `app/_layout.tsx:53,61` già tratta il DSN vuoto come Sentry spento.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungi in fondo a `lib/native-config.test.ts`:

```ts
type EasProfile = { env?: Record<string, string>; ios?: { credentialsSource?: string } };
type EasJson = { cli: { appVersionSource: string }; build: Record<string, EasProfile> };

const easJson = JSON.parse(readFileSync(path.join(ROOT, "eas.json"), "utf8")) as EasJson;
const STORE_PROFILES = ["preview", "production"] as const;

describe("eas.json — profili di build", () => {
  it("i numeri di versione vivono su EAS, non in app.json", () => {
    expect(easJson.cli.appVersionSource).toBe("remote");
  });

  it.each(STORE_PROFILES)("%s porta Supabase e gli slot di Sentry e RevenueCat", (profile) => {
    const env = easJson.build[profile].env ?? {};
    for (const key of [
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "EXPO_PUBLIC_SENTRY_DSN",
      "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
      "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
    ]) {
      expect(Object.keys(env), `${profile}.env.${key}`).toContain(key);
    }
  });

  it.each(STORE_PROFILES)("%s: finché il DSN è vuoto l'upload delle sourcemap resta spento", (profile) => {
    // Senza SENTRY_AUTH_TOKEN il passo sentry-cli fa FALLIRE la build
    // (docs/DEPLOY.md § "Builds WITHOUT a Sentry token fail"). Il token nasce
    // insieme al DSN: DSN vuoto significa che non c'è nemmeno il token.
    const env = easJson.build[profile].env ?? {};
    if ((env.EXPO_PUBLIC_SENTRY_DSN ?? "") === "") {
      expect(env.SENTRY_DISABLE_AUTO_UPLOAD).toBe("true");
    }
  });

  it("development tiene l'upload spento per sempre ed è l'unico profilo demo", () => {
    expect(easJson.build.development.env?.SENTRY_DISABLE_AUTO_UPLOAD).toBe("true");
    // AGENTS.md §3: mai EXPO_PUBLIC_DEMO_MODE in un profilo store.
    expect(easJson.build.preview.env?.EXPO_PUBLIC_DEMO_MODE).toBeUndefined();
    expect(easJson.build.production.env?.EXPO_PUBLIC_DEMO_MODE).toBeUndefined();
  });

  it("iOS firma con le credenziali locali", () => {
    expect(easJson.build.production.ios?.credentialsSource).toBe("local");
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- lib/native-config.test.ts`
Expected: FAIL — `preview.env.EXPO_PUBLIC_SENTRY_DSN` (e le due RevenueCat) mancano.

- [ ] **Step 3: Aggiungere gli slot in `eas.json`**

Sostituisci il blocco `env` del profilo `preview` (righe 19-23) con:

```json
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://taekvxxljtgzsjrlmumo.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_ov-GrA3U6G8HZ92mMSY8Zw_IkRzTNIG",
        "EXPO_PUBLIC_SENTRY_DSN": "",
        "EXPO_PUBLIC_REVENUECAT_IOS_KEY": "",
        "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "",
        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
      },
```

e il blocco `env` del profilo `production` (righe 31-35) con lo stesso identico contenuto. Il profilo `development` non cambia. La sezione `submit` non cambia.

Una stringa vuota è una variabile valida per EAS: Expo la inlinea come `""`, `SENTRY_DSN.length > 0` è falso e Sentry resta spento; B4 fa lo stesso con le chiavi RevenueCat. Quando Angelo ha i valori, li incolla QUI (e in `.env` locale, per le OTA) prima del commit della build — vedi checklist finale.

- [ ] **Step 4: Documentare le variabili in `.env.example`**

Aggiungi in fondo a `.env.example`:

```bash

# RevenueCat public SDK keys (B4 — piani Free/Pro/Premium). Pubbliche come la
# anon key di Supabase: per le build stanno in eas.json `env` (preview e
# production), per le OTA le legge `eas update` da QUESTO file. Vuote = SDK
# non configurato: l'app si comporta da Free e non chiama mai Purchases.
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- lib/native-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck e commit**

```bash
npm run lint
git add eas.json .env.example lib/native-config.test.ts
git commit -F - <<'EOF'
chore(eas): slot per DSN Sentry e chiavi RevenueCat nei profili preview e production

Valori vuoti finché Angelo non crea org Sentry e progetto RevenueCat: Sentry
resta spento (app/_layout.tsx:61) e B4 tratta la chiave vuota come Free.
Il test impone che con DSN vuoto SENTRY_DISABLE_AUTO_UPLOAD resti "true"
(senza token la build fallisce al passo sentry-cli) e che nessun profilo
store porti EXPO_PUBLIC_DEMO_MODE. eas.json è input del fingerprint: solo
build 3.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
```

---

### Task 4: Documentazione — DEPLOY.md, TROUBLESHOOTING.md, AGENTS.md

**Files:**
- Modify: `docs/DEPLOY.md` — riga di stato "Real icon / adaptive icon / splash", § OTA updates, § Sentry ("Values to fill in"), § Brand assets, nuova sezione prima di `## Release checklist`, il blocco ⚠️ e le caselle della checklist
- Modify: `docs/TROUBLESHOOTING.md` § "OTA e runtime: i binari spediti NON hanno il fingerprint di HEAD (2026-08-31)"
- Modify: `AGENTS.md` § 8 (righe `| Sentry |` e `| Pre-build sanity |`)

**Interfaces:**
- Produces: la sequenza umana della build 3 (§ "Build 3 (vc13 / iOS 3)") che il Task 6 esegue passo per passo; la nuova baseline OTA.

> **Niente numeri di riga in questo Task, di proposito.** Gli step 1 e 2
> spostano tutto ciò che sta sotto di loro (§ Brand assets +2 righe, § OTA
> ~+9), quindi allo step 3 la "riga 353" non è più la 353. Ogni edit qui sotto
> indica il **testo di ancoraggio**, che è univoco nel file: cercalo, non
> contarlo.

- [ ] **Step 1: Stato e tabella brand in `docs/DEPLOY.md`**

Nella lista "What's already set up", sostituisci la riga `- Real icon / adaptive icon / splash; store icons in \`docs/store-assets/\`` con:

```markdown
- Icon v2 ("il cervello è il quadrato") wired for build 3 (vc13 / iOS 3); splash still v1; store icons v2 in `docs/store-assets/`
```

Nella tabella di § Brand assets, sostituisci le righe `assets/icon.png` e `assets/adaptive-icon.png` con:

```markdown
| `assets/icon.png` | 1024×1024 RGBA (alpha all 255) = `assets/brand/icon-v2/icon.png`, byte for byte | `expo.icon`. Prebuild flattens it to RGB on white (`withIosIcons` → `removeTransparency`), so an opaque RGBA source is fine for Apple |
| `assets/adaptive-icon.png` | 1024×1024 RGBA opaque, full-bleed pink brain = `assets/brand/icon-v2/adaptive-icon.png` | `expo.android.adaptiveIcon.foregroundImage` on `#F8D2C4` (v1 was navy on `#142450`) |
| `assets/notification-icon.png` | 96×96 RGBA, WHITE on transparent (Android uses only the alpha), source `assets/brand/icon-v2/notification-icon.source.mjs` | `expo-notifications` plugin `icon`, tinted with `color` `#3B6BF5` — the DARK accent: the tint lands in a single `res/values/colors.xml` (no `values-night`), so it must read on a dark shade too |
```

Sostituisci poi le due righe degli asset di store (`docs/store-assets/appstore-icon-1024.png` e `docs/store-assets/play-icon-512.png`) con:

```markdown
| `docs/store-assets/appstore-icon-1024.png` | 1024×1024 RGB, no alpha — the v2 **flattened**, byte for byte = `assets/brand/icon-v2/appstore-icon-1024.png` (this file goes through no pipeline and ASC rejects alpha) | App Store Connect listing icon (upload manually) |
| `docs/store-assets/play-icon-512.png` | 512×512 RGBA = `assets/brand/icon-v2/play-icon-512.png`, byte for byte (Play accepts alpha) | Google Play Console "App icon" (upload manually) |
```

e sostituisci il paragrafo di apertura della sezione (`All launcher / splash artwork is derived from the navy brand tile…`) con:

```markdown
Launcher icons are the approved v2 (`assets/brand/icon-v2/`, vector source
`brain-icon.source.mjs`, sharp — never in `package.json`). The splash still
derives from the v1 navy tile in `assets/brand/icon.png`; the icon-v2 README
does not cover it and no spec asks for it.
```

Infine, nel paragrafo di chiusura della sezione, sostituisci `must resolve without warnings and` con:

```markdown
must resolve with no NEW warning (`userInterfaceStyle: Install expo-system-ui in
your project…` is emitted by the unversioned plugin for any non-empty value and
has been there since before build 3 — harmless, `Appearance` follows the system
anyway) and
```

- [ ] **Step 2: Nuova baseline OTA in `docs/DEPLOY.md` § OTA**

Subito dopo il blockquote che inizia con `> **\`.env\` foot-gun.**` e prima della riga `**Enabled 2026-08-26**`, aggiungi:

```markdown
> **Dalla build 3 (vc13 / iOS 3).** I due binari nascono dallo STESSO commit di
> `main`, quindi un HEAD pulito produce esattamente i loro due fingerprint e
> `eas update --channel production --message "…"` da `main` li raggiunge
> entrambi. Prima di ogni publish: `npx expo-updates fingerprint:generate
> --platform android` e `--platform ios` devono stampare gli hash registrati in
> § "Build 3" qui sotto; se uno differisce, qualcuno ha toccato un input del
> fingerprint dopo la build e quell'update NON arriverà a nessuno. La ricetta
> checkout-dance di `TROUBLESHOOTING.md` vale SOLO per vc12 / iOS build 2.
```

- [ ] **Step 3: Sezione "Build 3" in `docs/DEPLOY.md`**

Inserisci PRIMA della riga `## Release checklist (state as of 2026-08-29)`:

````markdown
## Build 3 (vc13 / iOS 3) — cosa porta e come esce

Una sola build nativa per tutto il blocco (spec 2026-09-02, "Ordine di
esecuzione"): ogni voce cambia il fingerprint e una build separata per ognuna
avrebbe staccato quattro volte gli OTA dai binari in circolazione.

| Voce | Piano | Dove |
|---|---|---|
| `userInterfaceStyle: "automatic"` (tema Default segue il telefono) | F1 | `app.json` |
| plugin `expo-notifications` (icona bianca, tinta `#3B6BF5`, l'accent scuro: un solo `colors.xml`, deve leggersi anche sulla tendina scura) | F3 | `app.json`, `assets/notification-icon.png` |
| plugin `expo-image-picker` (frasi italiane, microfono escluso, `RECORD_AUDIO` bloccato) | B5 | `app.json` |
| `react-native-purchases` (autolink, `com.android.vending.BILLING`) + slot chiavi | B4 | `package.json`, `app.json`, `eas.json` |
| icona v2 su sfondo `#F8D2C4` | — | `assets/`, `app.json` |
| slot `EXPO_PUBLIC_SENTRY_DSN` (vuoto finché non c'è l'org) | — | `eas.json` |

Numeri: `appVersionSource: "remote"` + `autoIncrement` → EAS assegna da sé
**versionCode 13** e **buildNumber 3** (contatori letti il 2026-09-03: 12 e 2).
Una build fallita consuma il numero: l'etichetta va scritta DOPO, da
`eas build:list`.

### Prima di lanciare (tutte umane, in quest'ordine)

1. Gli OTA per i binari attuali sono già pubblicati da `main` con la ricetta
   di `TROUBLESHOOTING.md` (una gamba per piattaforma) e **vc12 è su Play
   internal testing** — dopo la build 3 quei runtime non ricevono più nulla.
2. F3, B4 e B5 sono mergiati su `build-3`; il Task 5 del piano
   `2026-09-03-build3-config-nativa.md` (attivazione) è committato.
3. Sentry: o Angelo ha creato l'org e i valori sono in `app.json` (slug) e
   `eas.json` (DSN, `SENTRY_DISABLE_AUTO_UPLOAD` tolto da preview/production,
   token via `eas env:create`), oppure gli slot restano vuoti e Sentry resta
   spento in questa build (aggiungerlo dopo = ancora una build nativa).
4. RevenueCat: stesso bivio per `EXPO_PUBLIC_REVENUECAT_*_KEY`. Vuote = l'app è
   Free per tutti e non chiama mai l'SDK.
5. Nel worktree: `npm prune --legacy-peer-deps`, `npx expo-doctor`,
   introspezione + `node scripts/native-config/check-introspect.cjs`,
   `npm run lint`, `npm test`, pre-check Hermes, `git status` pulito.
6. Le migrazioni di B4 (`20260903100000_plans.sql`) e B5
   (`20260903110000_memory_photos.sql`) sono in `supabase/migrations/` del
   branch, in quest'ordine, e quella di B4 contiene il seed `plan = 'premium'`
   dei due tester PRIMA dei `create trigger`. Verifica:
   `grep -n "premium\|create trigger" supabase/migrations/20260903100000_plans.sql`
   deve mostrare l'`update public.profiles` **sopra** la prima riga
   `create trigger`. (Il seed sta lì e non in una query a mano prima del push
   perché la colonna `plan` nasce nella stessa migrazione: eseguirlo prima
   fallirebbe con `42703`, eseguirlo dopo lascerebbe Maurizio — vc11, senza
   paywall — bloccato a 10 ricordi nella finestra intermedia.)
7. La **edge function di verifica RevenueCat** di B4 esiste sul branch
   (`ls supabase/functions` deve elencare `revenuecat-sync`; oggi quella
   cartella non esiste affatto: il repo ha solo `config.toml`, `migrations/`,
   `templates/`) e Angelo ha sottomano la chiave segreta `sk_` di RevenueCat
   da darle, più il valore di `REVENUECAT_WEBHOOK_SECRET`. La spec la rende
   obbligatoria:
   «il client legge l'entitlement e chiama una edge function che verifica con
   l'API REST di RevenueCat prima di scrivere `profiles.plan`». Se B4 ha
   spedito il paywall senza function, **fermarsi**: vc13 uscirebbe con un
   client che chiama un endpoint inesistente e ogni acquisto fallirebbe a
   scrivere il piano, in silenzio.

### Sequenza

```bash
# 1. Merge su main e build dall'albero collegato (credenziali iOS + link Supabase)
cd "C:/Users/Angelo/Desktop/Tailor App Studio/Memika/memika-app"
git status --short                      # deve essere vuoto
git merge build-3                       # o --ff-only se main non è avanzato
npm ci                                  # .npmrc porta legacy-peer-deps
npx expo-updates fingerprint:generate --platform android
npx expo-updates fingerprint:generate --platform ios
#    → gli stessi due hash calcolati nel worktree al punto 5 (stesso albero)

# 2. Build (Angelo lancia; ~20-40 min in coda gratuita)
eas build --profile production --platform all --non-interactive --no-wait
eas build:list --limit 2 --json         # appBuildVersion 13 / 3, status FINISHED
eas build:view <id-android> --json      # runtimeVersion = hash android di sopra
eas build:view <id-ios> --json          # runtimeVersion = hash ios di sopra

# 3. Migrazioni in produzione — DOPO che le build sono FINISHED, PRIMA del submit
npx supabase db push --dry-run          # elenca SOLO le migrazioni B4/B5
npx supabase db push
npx supabase db query --linked "select u.email, p.plan, p.plan_until from public.profiles p join auth.users u on u.id = p.id order by u.created_at"
#    → Angelo e Maurizio a 'premium'. Se NON lo sono, subito:
#    npx supabase db query --linked "update public.profiles set plan = 'premium' where id in (select id from auth.users where email in ('<email Angelo dalla select>', '<email Maurizio dalla select>'))"

# 3b. Edge function di B4 — revenuecat-sync (verifica l'entitlement con l'API
#     REST di RevenueCat prima di scrivere profiles.plan). Senza questo, ogni
#     acquisto della vc13 chiama un endpoint che non esiste e il piano non
#     viene mai scritto.
ls supabase/functions                   # deve elencare revenuecat-sync
npx supabase secrets set \
  REVENUECAT_SECRET_KEY=<la chiave sk_ dalla dashboard RevenueCat> \
  REVENUECAT_WEBHOOK_SECRET=<stringa lunga a caso, la stessa dell'header nel cruscotto RevenueCat> \
  --project-ref taekvxxljtgzsjrlmumo
#    MAI EXPO_PUBLIC_: sono segreti, stanno solo qui. Il webhook secret va
#    incollato IDENTICO in RevenueCat → Integrations → Webhooks (header
#    Authorization, inviato verbatim, senza "Bearer").
npx supabase functions deploy revenuecat-sync --project-ref taekvxxljtgzsjrlmumo
npx supabase functions list --project-ref taekvxxljtgzsjrlmumo   # revenuecat-sync risulta ACTIVE

# 4. Store
eas submit -p ios --latest --non-interactive        # chiave ASC in eas.json → TestFlight "Memika interni"
node scripts/ios-credentials/asc-ops.mjs status     # processing → VALID
eas build:list --platform android --limit 1 --json  # artifacts.applicationArchiveUrl
#    scarica l'AAB in Memika/builds/memika-android-vc13-<data>.aab e caricalo a
#    mano in Play Console → Test interno (eas submit -p android non ha la
#    Google Service Account Key). Nella scheda Play carica anche
#    docs/store-assets/play-icon-512.png (icona v2).

# 5. Registra i runtime e chiudi
#    → tabella "Runtime della build 3" qui sotto + nota in TROUBLESHOOTING.md,
#      commit "docs(deploy): runtime della build 3 registrati", push.
```

Perché le migrazioni vanno fra build e submit: il codice B4 della build 3
legge `profiles.plan`, quindi le colonne devono esistere prima che un tester
installi vc13; e il trigger dei 10 ricordi non deve toccare Maurizio (vc11,
senza paywall) — per questo i tester sono `premium` dentro la migration
stessa, non dopo.

### Runtime della build 3

Da compilare al punto 5 con `eas build:view <id> --json` → `runtimeVersion`.

| Binario | EAS build id | Runtime (fingerprint) |
|---|---|---|
| Android vc13 | | |
| iOS build 3 | | |

Da qui in poi gli OTA partono da un HEAD pulito di `main` il cui
`fingerprint:generate` coincide con questi due valori (vedi § OTA updates).

### Sentry — checklist di Angelo (valori che il repo non può inventare)

1. Creare l'org su Sentry in regione **EU** (Frankfurt, `de.sentry.io`) e il
   progetto React Native `memika-app`.
2. Copiare slug org e progetto in `app.json` → plugin `@sentry/react-native/expo`
   (`organization`, `project`); se l'org è in regione US, **eliminare** la
   chiave `url`.
3. Incollare il DSN in `eas.json` → `build.preview.env.EXPO_PUBLIC_SENTRY_DSN` e
   `build.production.env.EXPO_PUBLIC_SENTRY_DSN`, e in `.env` locale (per le
   OTA, che leggono `.env`).
4. Creare un auth token (scopes `project:releases`, `org:read`) e salvarlo
   fuori da git:
   `eas env:create --scope project --environment production --name SENTRY_AUTH_TOKEN --value <token> --visibility secret`
   e lo stesso con `--environment preview`.
5. Solo ORA togliere `SENTRY_DISABLE_AUTO_UPLOAD` da `preview` e `production`
   (`development` lo tiene per sempre). Il test `lib/native-config.test.ts`
   accetta la rimozione solo se il DSN non è vuoto.
6. Tutto questo PRIMA di `eas build`: `app.json` ed `eas.json` sono input del
   fingerprint, farlo dopo staccherebbe vc13 / iOS 3 dagli OTA.
7. Dopo la build: nel log cercare `sentry-cli - Uploaded … source maps` (iOS)
   / `:app:sentryUpload` (Android); in una build preview lanciare un errore di
   prova e vederlo su Sentry con lo stack simbolizzato.

### RevenueCat — checklist di Angelo

1. Progetto RevenueCat sotto memikaapp@gmail.com, un'app per piattaforma
   (bundle `studio.tailor.memika`), entitlement `pro` e `premium` (spec B4).
2. Chiavi pubbliche `appl_…` / `goog_…` in `eas.json` →
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   (preview e production) e in `.env` locale. La chiave segreta `sk_` SOLO
   nell'env della edge function di B4 (`npx supabase secrets set
   REVENUECAT_SECRET_KEY=…`, punto 3b della Sequenza), mai `EXPO_PUBLIC_`:
   una chiave `EXPO_PUBLIC_` finisce dentro il bundle JS spedito.
3. Prerequisiti store: Paid Apps Agreement + In-App Purchase Key (.p8) su App
   Store Connect; prodotti su Play (richiede vc13 su un track). Senza, le
   offerte arrivano vuote — non è un bug del client.
````

- [ ] **Step 4: Blocco ⚠️, checklist stantia e Sentry "valori" in `docs/DEPLOY.md`**

Il blocco ⚠️ che inizia con `> ⚠️ **NON usare \`eas update --channel production --platform all\`.**` sta dentro la release checklist e, così com'è, dalla build 3 vieta il comando GIUSTO. **Non cancellarlo** (è la storia di due update orfani): premettigli, come prima riga dello stesso blockquote, quattro righe di contesto —

```markdown
> **Storico: valeva per vc11/vc12 / iOS build 2.** Dalla build 3 (vc13 / iOS 3)
> i due binari nascono dallo stesso commit e `eas update --channel production`
> (senza `--platform`) li raggiunge entrambi — vedi § "Build 3" e § "OTA
> updates". Quanto segue resta come storia del 2026-08/09.
>
```

Nell'intestazione della checklist, sostituisci `## Release checklist (state as of 2026-08-29)` con:

```markdown
## Release checklist (state as of 2026-09-03, build 3)
```

Sostituisci la casella `- [x] Icon / adaptive icon / splash real; store icons in \`docs/store-assets/\`` con:

```markdown
- [x] Icon v2 (build 3) + adaptive icon on `#F8D2C4`; splash still v1; store
      icons in `docs/store-assets/`
```

Sostituisci la casella che inizia con `- [ ] Add \`SENTRY_DISABLE_AUTO_UPLOAD=true\` to every \`eas.json\` profile env` (due righe, la seconda è `(remove from \`preview\`/\`production\` once \`SENTRY_AUTH_TOKEN\` exists)`) con:

```markdown
- [x] `SENTRY_DISABLE_AUTO_UPLOAD=true` in every `eas.json` profile env since
      2026-08-25; DSN slots added 2026-09-03 (remove the flag from
      `preview`/`production` only with a real DSN + `SENTRY_AUTH_TOKEN`)
```

Sostituisci la casella che inizia con `- [ ] \`eas build --profile production --platform android\` succeeds` (due righe, la seconda finisce con `\`eas submit -p android\` to the Internal track`) con:

```markdown
- [ ] Android: production build OK; vc12 uploaded BY HAND to Play internal
      (2026-09), vc13 the same way — `eas submit -p android` stays unusable
      until the Google Service Account Key exists
```

In § Sentry, dopo il punto 3 della lista "Values to fill in" (il punto che si chiude con il blocco bash contenente `eas env:create`), aggiungi:

```markdown
4. Since 2026-09-03 both store profiles carry `EXPO_PUBLIC_SENTRY_DSN: ""`
   as a slot: paste the DSN there, do not add a new key. The full order of
   operations is in § "Build 3" → "Sentry — checklist di Angelo".
```

- [ ] **Step 5: Marcare la ricetta storica in `docs/TROUBLESHOOTING.md`**

Subito sotto il titolo `## OTA e runtime: i binari spediti NON hanno il fingerprint di HEAD (2026-08-31)` e prima del paragrafo che inizia con `\`.gitignore\` ed \`eas.json\` sono input del fingerprint.`, aggiungi:

```markdown

> **Vale SOLO finché in circolazione ci sono vc12 e iOS build 2.** Dalla
> build 3 (vc13 / iOS 3) i due binari nascono dallo stesso commit e gli OTA
> si pubblicano da un HEAD pulito di `main` — regola e hash in
> `docs/DEPLOY.md` § "Build 3" e § "OTA updates". Questa ricetta resta come
> storia e come esempio di cosa succede quando `.gitignore` o `eas.json`
> cambiano dopo una build.
```

- [ ] **Step 6: Righe Sentry e pre-build in `AGENTS.md`**

Nella tabella di § 8, riga che inizia con `| Sentry |`, sostituisci la cella `Auth` (la terza) con:

```markdown
No org yet — placeholders `memika` / `memika-app` on `https://de.sentry.io/`; `eas.json` preview/production carry an EMPTY `EXPO_PUBLIC_SENTRY_DSN` slot (Sentry stays off). Source-map upload needs `SENTRY_AUTH_TOKEN` as an EAS secret, or `SENTRY_DISABLE_AUTO_UPLOAD=true` in the profile env, otherwise the build fails. Order of operations: `docs/DEPLOY.md` § "Build 3" → Sentry checklist.
```

Nella riga che inizia con `| Pre-build sanity |`, cella `Entry` (la seconda), aggiungi dopo `npx expo config --type introspect --json`:

```markdown
 → `node scripts/native-config/check-introspect.cjs <file.json>`
```

- [ ] **Step 7: Commit**

```bash
git add docs/DEPLOY.md docs/TROUBLESHOOTING.md AGENTS.md
git commit -F - <<'EOF'
docs(deploy): checklist della build 3, sequenza umana e nuova baseline OTA

Sezione "Build 3 (vc13 / iOS 3)": cosa porta, prerequisiti, sequenza
merge → build → migrazioni B4/B5 (tester premium dentro la migration) →
deploy della edge function di B4 con il suo segreto sk_ → TestFlight + Play
manuale → registrazione dei runtime. Checklist Sentry e RevenueCat per i
valori che solo Angelo ha. Il blocco che vietava "eas update --channel
production" è marcato storico: dalla build 3 quello è il comando giusto,
perché i due binari nascono dallo stesso commit. La ricetta checkout-dance di
TROUBLESHOOTING resta come storia.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
```

---

### Task 5: Attivazione — SOLO dopo il merge di F3, B4 e B5 su `build-3`

**Files:**
- Modify: `lib/constants.ts` (`NOTIFICATIONS_ENABLED`, unica costante che cambia valore)
- Modify: `lib/i18n/it.ts`, `lib/i18n/en.ts`, `lib/i18n/fr.ts`, `lib/i18n/es.ts` (la sola chiave `settings.themeHint`)

> **Nessun numero di riga in questo Task, di proposito.** Quando gira, tre
> piani hanno già riscritto questi cinque file: F3 ha sostituito il commento
> sopra `NOTIFICATIONS_ENABLED` con uno più lungo, B4 ha cancellato da
> `lib/constants.ts` `SUBFOLDERS_MAX`, `FREE_FOLDER_LIMIT`,
> `FOLDER_LIMIT_ENFORCED` e `PREMIUM_ENABLED` (~22 righe in meno, tutte sopra
> il flag), e i tre piani insieme hanno aggiunto ~90 chiavi ai cataloghi i18n.
> Ogni edit qui sotto si ancora al testo, che è univoco: cercalo con `grep`,
> non contarlo.

**Interfaces:**
- Consumes: la schermata `/notifications` di F3 dietro `NOTIFICATIONS_ENABLED` — dopo F3 in `app/(app)/settings.tsx` resta **un solo** gate su quel flag, la riga con chevron che apre `/notifications` (il blocco "Schedule" e quello "Notifications" inline sono stati cancellati); la gating per piano di B4.
- Produces: `NOTIFICATIONS_ENABLED = true`. Nessun'altra costante cambia valore in questo piano.

**Prerequisito verificabile:** `git log --oneline main..build-3` mostra i commit di F3, B4 e B5. Se manca uno dei tre, fermati: attivare `NOTIFICATIONS_ENABLED` senza la schermata di F3 riporterebbe alla luce le vecchie sezioni "Orari"/"Notifiche" a sola lettura (Apple 2.1, funzionalità segnaposto).

- [ ] **Step 1: Accendere le notifiche**

In `lib/constants.ts`, sostituisci il blocco di commento e la costante — dal `/**` che apre il commento che comincia con `Local notifications (spec 2026-09-02 §F3) are BUILT` (lo ha scritto il piano notifiche, Task 8 Step 1; prima diceva `Notifications (schedule rows, …`) fino alla riga `export const NOTIFICATIONS_ENABLED = false;` compresa — con:

```ts
/**
 * Notifiche locali (F3): il plugin expo-notifications è in app.json dalla
 * build 3 (vc13 / iOS 3) e la schermata /notifications legge le colonne del
 * profilo. Il flag resta come kill-switch. Acceso è sicuro anche verso i
 * binari vecchi: non ricevono più OTA da questo albero (fingerprint diverso),
 * quindi nessun bundle con il flag a true gira mai senza il modulo nativo.
 */
export const NOTIFICATIONS_ENABLED = true;
```

- [ ] **Step 2: Le costanti del paywall — verificare che B4 le abbia già ritirate, e la documentazione con loro**

`PREMIUM_ENABLED`, `FREE_FOLDER_LIMIT`, `FOLDER_LIMIT_ENFORCED` e `SUBFOLDERS_MAX` **non si toccano in questo piano**: le ritira B4 (`2026-09-03-piani-paywall-revenuecat.md`, Task 8 Step 2), che gira prima di questo Task, insieme alla bonifica dei documenti che le descrivono come meccanismo vigente. Non è una divisione arbitraria: quelle costanti sono citate come vigenti in **15 punti della documentazione**, in 9 file — `docs/PAYMENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/DATA-MODEL.md`, `docs/app-store-listing.md`, `docs/store-listing.md`, `README.md`, `AGENTS.md` §1 — e `AGENTS.md` §2 impone quei documenti come lettura obbligatoria. Cancellare i simboli senza bonificare i documenti è il rischio 7 della spec applicato ai piani: il prossimo agente cerca un simbolo che non esiste, e `npm run lint` non se ne accorge. Chi possiede la gating per piano possiede anche `docs/PAYMENTS.md`: rimozione e bonifica stanno nello stesso commit, di B4.

Qui si verifica soltanto che il lavoro sia stato fatto per intero:

```bash
# a) nessuna dichiarazione viva
grep -rn "export const \(PREMIUM_ENABLED\|FREE_FOLDER_LIMIT\|FOLDER_LIMIT_ENFORCED\|SUBFOLDERS_MAX\)" lib
# b) nessun uso vivo (import, JSX, confronto)
grep -rn "PREMIUM_ENABLED\|FREE_FOLDER_LIMIT\|FOLDER_LIMIT_ENFORCED\|SUBFOLDERS_MAX" app lib components features --include=*.ts --include=*.tsx
# c) nessun documento che li descriva come meccanismo in funzione.
#    --exclude-dir=superpowers è obbligatorio: piani e spec di questo ciclo
#    PARLANO di quelle costanti per dire che vanno ritirate, e senza
#    l'esclusione questo grep non può mai uscire vuoto.
grep -rn "PREMIUM_ENABLED\|FREE_FOLDER_LIMIT\|FOLDER_LIMIT_ENFORCED\|SUBFOLDERS_MAX" docs README.md AGENTS.md --exclude-dir=superpowers
```

Expected: (a) non trova **nulla**; (b) trova SOLO le due righe di commento storico che B4 lascia di proposito — il blocco di rimando a `lib/plan.ts` in `lib/constants.ts` («… sono stati rimossi il 2026-09-03», B4 Task 8 Step 2) ed eventualmente il commento riscritto di `lib/api.ts`; (c) trova al massimo righe che ne parlano al passato ("removed on 2026-09-03"). Se (a) trova una dichiarazione, se (b) trova un import o un uso (non un commento), o se (c) trova un documento che li descrive come meccanismo in funzione, **fermati e chiudi il lavoro di B4 prima di proseguire** — non rimediare qui: la bonifica è un commit di B4 (Task 9, Step 2bis), non di questo piano. Riporta l'esito nel corpo del commit dello Step 5.

- [ ] **Step 3: La copy del tema dice la verità**

Una chiave sola per catalogo, `settings.themeHint`. Trovala con `grep -n "settings.themeHint" lib/i18n/*.ts` — oggi promette il tema "da un prossimo aggiornamento dello store", e con la build 3 quella promessa è mantenuta. Sostituisci il valore:

```ts
// lib/i18n/it.ts
  "settings.themeHint": "Cambia subito. «Default» segue il tema del telefono.",
// lib/i18n/en.ts
  "settings.themeHint": "Applies right away. “Default” follows the phone theme.",
// lib/i18n/fr.ts
  "settings.themeHint": "Change tout de suite. « Default » suit le thème du téléphone.",
// lib/i18n/es.ts
  "settings.themeHint": "Cambia al instante. «Default» sigue el tema del teléfono.",
```

- [ ] **Step 4: Verificare tutto**

```bash
npm test
npm run lint
grep -rn "aggiornamento dello store\|store update\|mise à jour du store\|actualización de la tienda" lib/i18n/
grep -n "settings.themeHint" lib/i18n/it.ts lib/i18n/en.ts lib/i18n/fr.ts lib/i18n/es.ts
```

Expected: test e lint verdi (incluso `lib/i18n/i18n.test.ts`, stesse chiavi e nessun segnaposto in `settings.themeHint`); il primo `grep` non trova nulla — copre tutti e quattro i cataloghi perché fr ed es usano formulazioni diverse («…dans une prochaine mise à jour du store», «…en una próxima actualización de la tienda») e un grep solo su it/en resterebbe muto se dimenticassi uno dei due; il secondo stampa quattro righe, rileggile a occhio. `i18n.test.ts` controlla chiavi, segnaposto e plurali, **non** il contenuto: la bugia «arriverà in un aggiornamento futuro» uscirebbe in produzione proprio nella build in cui il tema comincia davvero a seguire il telefono.

- [ ] **Step 5: Commit**

```bash
git add lib/constants.ts lib/i18n/it.ts lib/i18n/en.ts lib/i18n/fr.ts lib/i18n/es.ts
git commit -F - <<'EOF'
feat(native): attivazione build 3 — notifiche accese, copy del tema vera

NOTIFICATIONS_ENABLED a true ora che la schermata di F3 e il plugin ci sono;
"Default segue il tema del telefono" nei quattro cataloghi, senza più il
rimando a un aggiornamento futuro. Costanti del vecchio paywall:
<esito della verifica dello Step 2>.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
```

Sostituisci `<esito della verifica dello Step 2>` con la frase vera: `ritirate da B4 insieme alla bonifica dei documenti, nessun riferimento vivo rimasto` oppure `ancora vive in <elenco dei file stampati dal grep>` (e in quel caso non committare: chiudi prima B4).

---

### Task 6: Verifica finale, build, migrazioni, store — gate umano

**Files:**
- Nessun file di codice. Modify (dopo la build): `docs/DEPLOY.md` § "Runtime della build 3", `docs/TROUBLESHOOTING.md`.

**Interfaces:**
- Consumes: `scripts/native-config/check-introspect.cjs` (Task 2), la sequenza in `docs/DEPLOY.md` § "Build 3" (Task 4), i test (Task 1-3), le credenziali iOS locali in `memika-app` (`.credentials/`, `credentials.json`), la chiave ASC in `Memika/builds/AuthKey_P54649SND2.p8`.
- Produces: vc13 su Play internal, iOS build 3 su TestFlight, migrazioni B4/B5 in produzione, la edge function di B4 deployata con il suo segreto, i due runtime registrati.

Gli step 1-3 sono meccanici e li fa l'agente. **Dallo step 4 in poi serve l'ok esplicito di Angelo** (`eas build`, `db push`, `supabase functions deploy`, `eas submit`, upload Play).

- [ ] **Step 1: Prerequisiti**

```bash
cd "C:/Users/Angelo/Desktop/Tailor App Studio/Memika/memika-build3"
git status --short                                   # vuoto
git log --oneline main..build-3                      # deps + Task 1-5 + F3 + B4 + B5
eas update:list --branch production --limit 4        # gli ultimi gruppi portano 9a1fad42 (android) e 19eda23c (ios)
eas build:version:get -p android -e production       # "Android versionCode - 12"
eas build:version:get -p ios -e production           # "iOS buildNumber - 2"
```

Expected: tutto come a destra. Se `eas update:list` non mostra un gruppo recente per entrambi i runtime, gli OTA verso i binari attuali NON sono stati pubblicati: fermarsi e farli prima da `main` (ricetta `docs/TROUBLESHOOTING.md` § "OTA e runtime…", il blocco bash che inizia con `git checkout 6c0d04b -- .gitignore eas.json`). Se vc12 non è su Play (Angelo conferma dalla Play Console), idem.

- [ ] **Step 2: Pre-check nel worktree**

```bash
npm prune --legacy-peer-deps
npx expo-doctor
TMP="$LOCALAPPDATA/Temp/memika-build3"; mkdir -p "$TMP"
npx expo config --type introspect --json > "$TMP/introspect.json"
node scripts/native-config/check-introspect.cjs "$TMP/introspect.json"
npm run lint
npm test
```

Expected: doctor 18/18; script `Tutto verde.`; lint e test verdi.

- [ ] **Step 3: Pre-check Hermes e fingerprint**

```bash
# TMP va ridefinito: lo stato della shell non sopravvive fra uno step e l'altro
# e su Windows $TMP esiste già come variabile d'ambiente (…/AppData/Local/Temp),
# quindi senza questa riga l'export finirebbe in una cartella diversa da quella
# dello Step 2.
TMP="$LOCALAPPDATA/Temp/memika-build3"; mkdir -p "$TMP"
rm -rf "$TMP/export"
npx expo export --platform android --no-bytecode --output-dir "$TMP/export"
BUNDLE=$(ls "$TMP"/export/_expo/static/js/android/*.js | head -1)
node_modules/react-native/sdks/hermesc/win64-bin/hermesc.exe -emit-binary -out "$TMP/index.hbc" "$BUNDLE"
echo "hermesc exit=$?"
npx expo-updates fingerprint:generate --platform android
npx expo-updates fingerprint:generate --platform ios
```

Expected: `hermesc exit=0`. I due hash sono **nuovi** — diversi da `9a1fad42…`/`19eda23c…` (binari attuali) e da `33c8a878…`/`d02cdb80…` (HEAD di `main` al 2026-09-02). Annotali: sono i runtime che EAS deve riportare in `build:view`.

- [ ] **Step 4 (Angelo): Merge, build, migrazioni, store**

**Precondizione, da verificare prima di lanciare qualsiasi cosa:** `ls supabase/functions` deve elencare `revenuecat-sync`, la edge function di verifica RevenueCat di B4 (oggi quella cartella non esiste: il repo ha solo `config.toml`, `migrations/`, `templates/`). È il punto 7 della lista "Prima di lanciare". Se manca, fermarsi e chiedere a chi ha spedito B4: senza function il client della vc13 chiama un endpoint inesistente e nessun acquisto scrive mai `profiles.plan`. Stessa cosa per il punto 6: il seed dei tester dentro `20260903100000_plans.sql`, sopra i `create trigger`.

Esegui la sezione "Sequenza" di `docs/DEPLOY.md` § "Build 3" nell'ordine scritto: merge su `main` in `memika-app` → `npm ci` → ricalcolo fingerprint (deve coincidere con lo step 3) → `eas build --profile production --platform all --non-interactive --no-wait` → attesa `FINISHED` con `appBuildVersion` 13 e 3 → `npx supabase db push --dry-run` / `db push` → verifica `plan` dei tester → `npx supabase functions deploy` + `secrets set REVENUECAT_SECRET_KEY` + `functions list` (punto 3b) → `eas submit -p ios --latest --non-interactive` → download AAB in `Memika/builds/memika-android-vc13-<data>.aab` → upload manuale in Play Console (Test interno) + icona v2 nella scheda.

Punti dove fermarsi e chiedere: il `--dry-run` elenca migrazioni diverse da quelle di B4/B5; la migration di B4 non contiene il seed dei tester prima del trigger; `functions list` non riporta la function come `ACTIVE`; `eas build:view` riporta un `runtimeVersion` diverso dallo step 3 (qualcosa è cambiato nell'albero tra pre-check e build).

- [ ] **Step 5: Registrare i runtime**

Da `memika-app`, con gli id delle due build:

```bash
RV='let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).runtimeVersion))'
AND=$(eas build:view <id-android> --json | node -e "$RV")
IOS=$(eas build:view <id-ios> --json | node -e "$RV")
echo "android=$AND ios=$IOS"     # due hash di 40 caratteri, uguali a quelli dello step 3
```

Compila la tabella "Runtime della build 3" in `docs/DEPLOY.md` con `<id-android>` / `$AND` e `<id-ios>` / `$IOS`, e aggiungi in fondo a `docs/TROUBLESHOOTING.md` § "OTA e runtime":

```markdown

**Build 3 (2026-09):** Android vc13 = `<$AND>`, iOS build 3 = `<$IOS>` — stesso
commit, stesso albero: `eas update --channel production` da `main` pulito li
raggiunge entrambi, previo `fingerprint:generate` che stampi proprio questi.
```

(sostituendo `<$AND>` / `<$IOS>` con i due hash stampati).

```bash
git add docs/DEPLOY.md docs/TROUBLESHOOTING.md
git commit -F - <<'EOF'
docs(deploy): runtime della build 3 registrati

Android vc13 e iOS build 3 nascono dallo stesso commit: da qui gli OTA si
pubblicano da main pulito, verificando prima che i fingerprint coincidano.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KRdjppLcC7ZZfPW9qNqWWw
EOF
git push origin main
```

---

## Verifica finale sul dispositivo (vc13 / iOS 3 installate)

1. **Icona v2** sulla home del telefono (cervello rosa), su Android con sfondo adattivo rosa senza anello.
2. **Tema:** Impostazioni → Aspetto → "Default"; con il telefono in scuro l'app è scura; la riga di hint dice "segue il tema del telefono".
3. **Notifiche (F3):** la notifica di prova mostra nella status bar Android il volto bianco, non un quadrato pieno. Guardala **due volte, con il telefono in tema chiaro e in tema scuro**: nella tendina il nome dell'app e l'icona piccola sono tinti di `#3B6BF5` e devono restare leggibili in entrambi i casi (è un unico `colors.xml`, non c'è una variante notte, e correggerlo richiederebbe la build 4). Su iOS compare la richiesta di permesso.
4. **Foto (B5):** il `+` in Add → "Fotocamera" mostra il prompt iOS in italiano ("Memika usa la fotocamera…"); su Android nessuna richiesta di microfono, mai.
5. **Piani (B4):** Impostazioni mostra i tester come Premium; un account free al decimo ricordo riceve il messaggio del limite, non un errore generico.
6. **Impostazioni → Versione** riporta `0.1.0 (13)` su Android e `0.1.0 (3)` su iOS; **Aggiornamento** = "di fabbrica".
7. **Sentry** (solo se il DSN c'era): un errore di prova in build preview arriva con stack simbolizzato.

**Da dire a Maurizio prima che aggiorni:** dopo l'aggiornamento l'app chiede il permesso per le notifiche al primo ricordo salvato, e il tema segue quello del telefono (se lo tiene scuro, l'app diventa scura: è voluto, si cambia in Impostazioni → Aspetto).

## Passi umani aperti (riepilogo)

| Chi | Cosa | Quando |
|---|---|---|
| Angelo | Pubblicare gli OTA di `main` verso vc12 / iOS 2 (ricetta TROUBLESHOOTING) e caricare vc12 su Play internal | PRIMA del merge di `build-3` |
| Angelo | Sentry: org EU + progetto → slug in `app.json`, DSN negli slot di `eas.json` e in `.env`, token via `eas env:create`, togliere `SENTRY_DISABLE_AUTO_UPLOAD` | PRIMA di `eas build`, oppure rinviare a una build futura |
| Angelo | RevenueCat: progetto + chiavi negli slot di `eas.json` e in `.env` | PRIMA di `eas build`, oppure lasciare vuoto (app Free per tutti) |
| Angelo | `eas build --profile production --platform all` da `memika-app` | dopo il Task 5 e i pre-check |
| Angelo | `npx supabase db push` (B4 + B5) da `memika-app`, verifica `plan = 'premium'` dei due tester | fra build FINISHED e submit |
| Angelo | `npx supabase secrets set REVENUECAT_SECRET_KEY=<sk_…> REVENUECAT_WEBHOOK_SECRET=<…>` + `functions deploy revenuecat-sync` + `functions list` = `ACTIVE` | subito dopo `db push`, prima del submit |
| Angelo | `eas submit -p ios`; upload manuale AAB vc13 + icona v2 in Play Console | subito dopo le migrazioni |
| ~~Angelo~~ | ~~Decidere sullo splash in scuro~~ — deciso e implementato il 2026-09-03: variante `dark` su `#0E1015` con la stessa arte | fatto |
