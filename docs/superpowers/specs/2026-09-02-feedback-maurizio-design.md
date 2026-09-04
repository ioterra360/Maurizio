# Feedback Maurizio — design (2026-09-02)

> **Nomi dei piani — nota 2026-09-04.** Questo documento e' STORICO e usa la
> scala vecchia: `pro` era la fascia intermedia e `premium` quella alta. Dal
> 2026-09-04 le fasce si chiamano **Free / Plus / Pro** (`plus` = intermedia,
> `pro` = alta): ogni "pro" e ogni "premium" qui sotto vanno letti con la
> vecchia scala. La scala viva sta in `lib/plan.ts` e `docs/PAYMENTS.md`.

Fonte: lista Angelo del 2026-09-01/02 (20 punti) + `materiale_maurizio/feedback_2026-09-01/home-mockup.jpg`
+ `materiale_maurizio/feedback_2026-08-28/` (10 screenshot timing) + `Memora Timing System UPDATED.pdf`.

Decisioni prese con Angelo prima di questa spec:

| Domanda | Scelta |
|---|---|
| Profondità scheduler | Scala fissa completa di Maurizio, end-to-end |
| Ancoraggio 20h | `T0 + 20h` esatte (niente snap a orario mattutino) |
| Notifiche | Adesso, insieme allo scheduler |
| Tema | Chiaro **e** scuro, default dal telefono, switch in Impostazioni, coerente in tutta l'app |
| Piani | Tre: Free / Pro / Premium, distinti |
| Limite free | 10 ricordi **totali** sull'account, blocco vero |
| Cartelle free | Una sola |
| Utenti esistenti | Grandfathering — tengono quello che hanno, non possono aggiungerne |
| Ordine | Prima le fondamenta, poi il resto |

---

## 0. Sblocco operativo — vc12 su Play (fuori spec, 10 minuti)

Non è sviluppo, ma senza questo nulla di ciò che segue arriva a Maurizio.

**Diagnosi, verificata sul server EAS.** Il canale `production` è uno solo per entrambe le
piattaforme, quindi il canale non è la causa. La causa è il `runtimeVersion`, che con
`"policy": "fingerprint"` (`app.json:81-83`) è calcolato **per piattaforma** e quindi diverge per
progetto.

| Update | Piattaforma | Runtime | Binario che lo può ricevere |
|---|---|---|---|
| "Sottocartelle…" (31/08) | ios | `19eda23c` | iOS build 2, su TestFlight ✅ |
| "Sottocartelle…" (31/08) | android | `9a1fad42` | vc12 — **mai pubblicata** ❌ |
| "Cestino 24h… titolo centrato" (31/08) | android | `9a1fad42` | vc12 — **mai pubblicata** ❌ |
| "Nome facoltativo… lingua iOS" (29/08) | android | `8c4be079` | vc11, live su Play ✅ |

Il fix della pillola lingua è il commit `f65a2f1` (31/08 02:34), uscito nell'update *"…titolo
centrato"* → runtime `9a1fad42` → build **vc12**, che è ferma in
`Memika/builds/memika-android-vc12-2026-08-29.aab` (EAS `9cb7bf2b`). `eas submit -p android` non è
mai stato eseguito: la casella nella checklist di `docs/DEPLOY.md` è tuttora vuota.

Maurizio ha **vc11** (runtime `8c4be079`). Per il suo telefono gli update del 31 agosto non
esistono: chiede al server il proprio runtime, il server non ha nulla, l'app tiene il bundle di
bordo. In silenzio — nessun errore, nessun log, niente che un tester possa riferire oltre a "non è
cambiato niente".

**Azione:** caricare vc12 su Play internal testing.

**Da correggere subito perché è una trappola attiva:** `docs/DEPLOY.md:367-368` prescrive
`eas update --channel production --platform all`. È meccanicamente incapace di raggiungere entrambi
i runtime, perché i due stati dell'albero di lavoro richiesti sono mutuamente esclusivi su
`.gitignore`, e da un HEAD pulito non ne raggiunge **nessuno** dei due. `docs/TROUBLESHOOTING.md:326-354`
dice la cosa giusta. Il documento sbagliato è quello che si chiama DEPLOY. Ha già prodotto due
update orfani (`33c8a878`, `d02cdb80`).

**Da aggiungere perché il fallimento è silenzioso per costruzione:** una riga "Aggiornamento" in
Impostazioni che mostri `Updates.updateId` e `Updates.runtimeVersion`. Oggi la riga "Versione"
(`settings.tsx:395`) riporta solo l'identità del binario nativo, quindi né un tester né Angelo
possono distinguere "l'OTA non è arrivata" da "è arrivata e la modifica è sottile".

---

# PARTE I — FONDAMENTA

## F1. Tema chiaro / scuro

### Stato attuale

- `app.json:9` → `"userInterfaceStyle": "light"`: il sistema non consegna mai il tratto scuro.
- `theme/tokens.ts` è **una sola palette piatta**. Nessuno split, nessun provider, nessun
  `Appearance` listener.
- `tailwind.config.js` non ha `darkMode` → NativeWind non emette varianti `dark:`.
- ~40 file importano `colors` da `@/theme/tokens` a livello di modulo.
- `AGENTS.md §6` elenca il tema scuro tra gli anti-pattern rifiutati. **Questa spec lo supera:
  va aggiornato**, altrimenti il prossimo agente che legge AGENTS.md disfa il lavoro.

### Il problema dei ruoli

`colors.navy` fa due mestieri: colore del **testo principale** e riempimento dei **bottoni /
pillole attive**. In chiaro coincidono; in scuro no — il testo diventa quasi bianco, il bottone
resta blu. Stessa cosa per `warmWhite`, che è sia sfondo schermata sia colore del testo dentro un
bottone navy.

Prima di poter avere due palette bisogna quindi **sdoppiare i ruoli**:

| Token nuovo | Ruolo | Light | Dark |
|---|---|---|---|
| `textPrimary` | testo principale | `#1A2C4F` | `#EDEFF4` |
| `textSecondary` | testo secondario, valori, hint | `#8A8A88` | `#8E96A8` |
| `accent` | riempimento CTA, pillola attiva, stripe | `#1A2C4F` | `#3B6BF5` |
| `onAccent` | testo sopra `accent` | `#FAF8F4` | `#FFFFFF` |

`navy`, `midGrey` e `warmWhite` restano esportati come **alias** di `textPrimary`,
`textSecondary` e `bgScreen` per non rompere i 40 file in un colpo solo; la migrazione dei call
site avviene per file mentre si tocca. In chiaro i valori sono identici agli attuali → **zero
cambiamenti visivi in modalità chiara**, che è il requisito che protegge tutto il lavoro grafico
già fatto.

### Palette

Chiara: invariata rispetto a `theme/tokens.ts` di oggi.

Scura (derivata dal mockup di Maurizio):

| Token | Valore | Note |
|---|---|---|
| `canvas` | `#08090C` | sfondo dello Stack |
| `bgScreen` (`warmWhite`) | `#0E1015` | sfondo schermata |
| `surface` | `#171A22` | card e righe |
| `surfaceElevated` | `#1E2230` | card hero, sheet |
| `textPrimary` | `#EDEFF4` | |
| `textSecondary` | `#8E96A8` | |
| `placeholder` | `#5C6270` | |
| `accent` | `#3B6BF5` | il blu del CTA nel mockup |
| `onAccent` | `#FFFFFF` | |
| `hairline` | `rgba(255,255,255,0.08)` | |
| `hairlineStrong` | `rgba(255,255,255,0.14)` | |
| `danger` | `#E2705A` | schiarito per contrasto su fondo scuro |
| `dangerSoft` | `#2A1714` | |
| `tagProBg` / `tagProText` | `#241F3D` / `#B9AEF5` | |
| `folderTint.*` | 4 tinte desaturate al 12% di luminanza | oggi sono pastelli su bianco |
| `layer.{scan,reinforcement,focus}` | varianti schiarite ~15% | leggibili su `surface` |

Vincolo verificabile: ogni coppia testo/sfondo deve superare **4.5:1** (WCAG AA). Un test
unitario calcola il rapporto di contrasto su tutte le coppie dichiarate e fallisce sotto soglia —
così una futura modifica di palette non può degradare l'accessibilità di nascosto.

### Meccanica

Nuovo `theme/theme-store.ts`, modellato **esattamente** su `lib/i18n/index.ts`, che risolve già
questo identico problema (preferenza + risoluzione + persistenza + idratazione prima del primo
frame) ed è collaudato:

```ts
type ThemePreference = "system" | "light" | "dark";
// stato: { preference, scheme }
// hydrate() legge AsyncStorage "memika.theme"; "system" è memorizzato come ASSENZA della chiave
// setPreference(p) → { preference: p, scheme: p === "system" ? Appearance.getColorScheme() : p }
```

- `Appearance.addChangeListener` aggiorna `scheme` quando la preferenza è `"system"` e l'utente
  cambia impostazione di sistema mentre l'app è aperta.
- `useColors()` restituisce il token object risolto. I componenti passano da
  `import { colors } from "@/theme/tokens"` a `const colors = useColors()`.
- **Trappola:** ogni uso di `colors` a livello di modulo (fuori da un componente) va spostato
  dentro il render, altrimenti si congela sulla palette di boot. Da censire con un grep dedicato
  prima di iniziare.
- NativeWind: `colorScheme.set(scheme)` da `nativewind` in un effect nel root layout, così le
  classi `dark:` e `useColors()` restano in accordo. `tailwind.config.js` prende
  `darkMode: "class"` e le varianti scure dei colori nominati.
- `app/_layout.tsx:320` → `<StatusBar style={scheme === "dark" ? "light" : "dark"} />`.
- `app/_layout.tsx:326` → sfondo dello Stack dal token risolto.
- `app.json:9` → `"userInterfaceStyle": "automatic"`. **Modifica nativa** → nuova build e nuovo
  fingerprint, quindi nuovo runtime: va fatta insieme alle altre modifiche native (F3, B5).

### UI in Impostazioni

Nuova sezione "Aspetto", **sopra** "Lingua", che riusa il pattern esatto di `LanguagePicker`
(`settings.tsx:682-740`): card `surface`, tre pillole `Tappable` — Default / Chiaro / Scuro —
più la riga di hint sotto. Coerenza gratis e nessun componente nuovo.

Chiavi i18n nuove (×4 cataloghi): `settings.appearanceSection`, `settings.themeSystem`,
`settings.themeLight`, `settings.themeDark`, `settings.themeHint`.

### Superficie

~40 file. È il pezzo singolo più grande della spec. Ordine di lavoro: token e store →
primitive condivise (`Tappable`, `PrimaryButton`, `GhostButton`, `SettingsRow`, `SectionLabel`,
`TopBar`, `FolderTile`, `Toast`) → schermate una alla volta, verificando entrambi i temi a ogni
passo.

---

## F2. Scheduler a fasi

### Stato attuale

Il motore è SM-2 puro a **giorni interi**, e non ha alcuna nozione di fase, finestra o scadenza.

- `features/srs/types.ts:59` → `nextReviewAt: now.toISOString()`. **Questa è la causa del punto 20:**
  ogni ricordo nasce già scaduto.
- `features/srs/scheduler.ts:71-73` → intervalli `1` → `6` → `×ease`. A ease 2.5 la scala reale è
  1g → 6g → 15g → 37g → 94g.
- `features/srs/scheduler.ts:48-50`, commento esplicito: *"We round the next interval to whole days.
  Sub-day intervals would force timezone math we don't want in the scheduler."* La colonna DB è
  `srs_interval_days int`. **20 ore oggi non sono rappresentabili.**
- Nessuna scadenza esiste. `state` cambia **solo** quando l'utente risponde a una carta
  (`deriveLifecycleState` è chiamata da dentro `update()`): una carta scaduta e mai aperta resta
  `active` per sempre.
- `archived` non viene **mai** impostato da nulla — pinnato da `scheduler.test.ts:151-166`.
- La copy mente: `it.ts:48` promette "Primo ripasso · domani, 8:00" e `it.ts:55` "primo ripasso
  domani". `docs/SRS.md:137-139` lo ammette per iscritto: *"intentional UX framing, not a real
  schedule push"*.
- L'`8:00` è finzione: `profiles.morning_review_at` esiste ma il suo **unico** consumatore in tutta
  l'app è una riga di sola lettura in Impostazioni (`settings.tsx:318`).
- Risolto e da non reinseguire: l'inversione dei layer segnalata il 28/08 **è già stata corretta**
  il 29/08 (commit `03b24a1`, `docs/SRS.md:99-101`). Oggi Focus = i più nuovi, coerente con la copy.

### La scala

Fonte: screenshot 00/01/02 del 28/08 (che prevalgono) + `Memora Timing System UPDATED.pdf` §6/§15.

| Fase | Disponibile | Scadenza | Ancoraggio | Layer |
|---|---|---|---|---|
| `p20h` | T0 + 20h | T0 + 48h | `created_at` | Focus |
| `p48h` | T0 + 48h | T0 + 72h | `created_at` | Focus |
| `p7d` | +7g | +8g | ultimo ripasso riuscito | Reinforcement |
| `p30d` | +30g | +32g | ultimo ripasso riuscito | Reinforcement |
| `p3m` | +90g | +94g | ultimo ripasso riuscito | Scan |
| `p6m` | +180g | +186g | ultimo ripasso riuscito | Scan |
| `p1y` | +365g | +385g | ultimo ripasso riuscito | Scan |

Le prime due tappe sono ancorate a T0; **dalla terza il conteggio riparte dall'ultimo ripasso
riuscito** (screenshot 02, testuale).

Il layer si deriva dalla **fase**, non più dal conteggio di ripetizioni. Il proxy attuale
(`srs_repetitions ≥ 4` = "3 mesi in poi") sbaglia: a ease standard 4 ripetizioni valgono ~37
giorni, quindi la fase 30 giorni — che la spec assegna a Reinforcement — finisce in Scan.

### Saltare e dimenticare

**Scaduta senza risposta** (screenshot 04): oltre `review_window_end` → `fading`; per `p20h` →
`archived`. Dopo l'ingresso in Fading, una seconda grazia dipendente dalla fase (7g per p48h e
p7d, 14g per p30d, 30g per p3m, 60g per p6m, 90g per p1y) porta ad `archived`.

**Fading** (screenshot 05): priorità superiore ai ripassi normali nell'ordinamento del mazzo, e se
ripassata e ricordata **ripete una volta lo stesso intervallo** invece di avanzare.

**Dimenticata** (screenshot 03): *"Dimenticato ≠ ricominciare tutto da zero."* Primo recupero
sempre a **+24h**; al successo si rientra secondo la fase in cui si era dimenticato, non da capo.
Oggi il codice fa `repetitions = 0; intervalDays = 1` — una carta di un anno e una di un giorno
sono trattate identicamente. Serve un flag `is_in_recovery`.

### Schema

```sql
alter table public.memories
  add column review_phase text not null default 'p20h'
    check (review_phase in ('p20h','p48h','p7d','p30d','p3m','p6m','p1y','done')),
  add column review_window_end timestamptz,
  add column is_in_recovery boolean not null default false,
  add column last_result text check (last_result in ('remembered','struggled','forgot'));
```

`next_review_at` resta e assume il significato di **inizio finestra**. `srs_interval_days`,
`srs_ease_factor`, `srs_repetitions` restano in tabella ma non sono più letti dallo scheduler:
si tolgono in una migrazione successiva, quando nessun binario in circolazione li usa più.

Nessuna di queste colonne va nella grant di UPDATE di `profiles`/`memories` per `authenticated`
oltre a quanto già concesso.

### Chi valuta le scadenze

Le transizioni `active → fading → archived` non dipendono da una risposta dell'utente: dipendono
dal passare del tempo. Il modello attuale (valuta solo quando rispondi) non può esprimerle.

**Scelta: valutazione pigra in SQL al momento della lettura**, non un job schedulato.

`fading` e `archived` sono funzioni pure di `review_phase`, `review_window_end` e `now()`. Una
funzione SQL `effective_state(memories) → memory_state` le calcola, e le query di lettura filtrano
su quella invece che sulla colonna `state`. La colonna `state` continua a esistere e viene
materializzata quando l'utente tocca la carta.

Perché non `pg_cron`: aggiunge una dipendenza dal piano Supabase e un punto di guasto silenzioso
(se il job non gira, gli stati sono sbagliati e nessuno se ne accorge). La valutazione pigra è
sempre corretta per costruzione e non ha niente da monitorare. Il costo è una funzione in più
nelle query, coperta dall'indice `memories_user_next_review_idx` già presente.

### Archivio recuperabile

Archiviare un ricordo 48 ore dopo che l'utente l'ha salvato è duro. Con le notifiche di F3
l'utente viene avvisato, quindi è difendibile — ma non deve essere una perdita.

Gli archiviati vanno in una lista "Archiviati" raggiungibile dalla cartella, con un tocco per
riportarli in circolo (ripartono da `p20h`). Nessun dato sparisce mai senza una via di ritorno.
Precedente di riferimento nel codice: il Cestino (`app/trash.tsx`).

### Migrazione dei dati esistenti

Backfill deterministico da `srs_repetitions`:

| reps | fase assegnata | `next_review_at` | `review_window_end` |
|---|---|---|---|
| 0 | `p20h` | `created_at + 20h` | `created_at + 48h` |
| 1 | `p48h` | `created_at + 48h` | `created_at + 72h` |
| 2 | `p7d` | `last_reviewed_at + 7g` | `+8g` |
| 3 | `p30d` | `last_reviewed_at + 30g` | `+32g` |
| ≥4 | `p3m` | `last_reviewed_at + 90g` | `+94g` |

Effetto sui tester: i ricordi aggiunti nelle ultime 20 ore **escono dalla coda di oggi** e
ricompaiono a T0+20h. È corretto, ma va detto a Maurizio prima, altrimenti sembra un bug.
Nessun ricordo esistente viene archiviato dal backfill: la grazia si conta dal momento della
migrazione, non retroattivamente.

### Copy da correggere

| Chiave | Oggi | Diventa |
|---|---|---|
| `add.previewFirstReview` | "Primo ripasso · domani, 8:00" | orario reale calcolato da T0+20h |
| `add.savedToast` | "Salvato in {name} · primo ripasso domani" | "Salvato in {name} · primo ripasso tra 20 ore" |
| `add.useItTodayHint` | "…il primo ripasso è domani." | "…il primo ripasso è tra 20 ore." |

`memory.nextReview` sulla scheda del ricordo mostrava una data che contraddiceva il toast: con la
scala vera i due tornano coerenti da soli.

---

## F3. Notifiche

### Stato attuale

`expo-notifications` **non è installato** — non è in `package.json` e non è in `node_modules`.
Zero codice runtime: nessun `scheduleNotificationAsync`, nessuna richiesta di permesso.
`NOTIFICATIONS_ENABLED = false` (`lib/constants.ts:244`) rende irraggiungibili le sezioni "Orari"
e "Notifiche" già scritte in `settings.tsx:308-371`. Le colonne `morning_review_at`,
`evening_review_at`, `calm_mode`, `weekly_digest` esistono e vengono scritte, ma **nessuno le
legge**. La capability Push è abilitata sull'App ID Apple e non è usata da nulla.

### Design

**Solo notifiche locali.** Nessun server, nessun token push, nessuna edge function. Due tipi:

1. **"Primo ripasso pronto"** — programmata al momento del salvataggio, per T0+20h, su quel
   singolo ricordo. È letteralmente il punto 20 reso visibile: l'utente salva una parola e venti
   ore dopo l'app glielo dice.
2. **Promemoria giornaliero** — all'orario scelto dall'utente. Copy generica, **senza numeri**:
   `PRODUCT.md` vieta i conteggi inventati e una notifica locale non può conoscere il conteggio
   reale al momento dello scatto.

`calm_mode` sopprime il promemoria giornaliero e lascia solo il primo tipo.

Permesso richiesto **dopo il primo ricordo salvato**, non all'avvio — un permesso chiesto a freddo
viene negato e non si può più richiedere.

### Selettore d'orario

Non esiste alcun time picker nell'app. Due strade: `@react-native-community/datetimepicker`
(nativo, dipendenza in più, aspetto deciso dall'OS) oppure una lista di slot da 30 minuti
costruita con `Tappable`.

**Scelta: la lista di slot.** Nessuna dipendenza nuova, controllo pieno sull'aspetto, funziona
identica su iOS e Android, e si tematizza gratis con F1. Precedente visivo diretto:
`TimeBudgetChips`.

### Schermata

`app/(app)/notifications.tsx`, raggiunta da una riga in Impostazioni (sezione "Notifiche", con
chevron e `router.push`), **non** un blocco inline.

Contenuto: interruttore principale · orario del promemoria (lista di slot) · interruttore "Avvisami
quando un ricordo è pronto per il primo ripasso" · Modalità calma · Riepilogo settimanale. Le
ultime due esistono già come copy e colonne, oggi irraggiungibili.

`NOTIFICATIONS_ENABLED` → `true`. Modifica nativa (plugin in `app.json`) → nuova build.

---

## F4. Cartelle: da `kind` a `id`, e la tassonomia

### Stato attuale

**La cartella *è* il suo `kind`.** `FOLDER_KINDS = ["jp","medicine","es","law","custom"]`
(`constants.ts:32`), con `unique(user_id, kind)` nel DB (`initial_schema.sql:63`). Da lì discende
tutto: la route è `/folder/[kind]`, `useFolderDetail(kind)` risolve la riga per kind, il
`keyExtractor` di Knowledge è `(f) => f.kind`, l'ordine persistito è un array di kind, e
`ITEM_TYPES_BY_KIND` / `ADD_PREVIEW_BY_KIND` / `FOLDER_LABELS` / `folderTint` sono `Record<FolderKind, …>`
esaustivi. `FolderTile.tsx:24-58` è una catena di `if` sul kind.

Conseguenze: **massimo 5 cartelle per account**, **una sola personalizzata**. La copy lo ammette
già: *"una cartella personalizzata per account, per ora"* (`it.ts:241`).

`color`, `icon` e `paused` sono colonne che **nessun codice scrive mai**.

Nota su `createFolder` (`api.ts:250-271`): se esiste una cartella dello stesso kind nel cestino, la
**resuscita** invece di inserire, perché `unique(user_id, kind)` fa fallire l'insert con 23505.
Tolto il vincolo, questa logica va rimossa — altrimenti creare "Spagnolo" fa riemergere lo
"Spagnolo" che l'utente aveva buttato.

### Migrazione

```sql
alter table public.folders
  drop constraint folders_user_id_kind_key,
  add column category text check (category in ('lingue','materie','lavoro','interessi','custom')),
  add column template_id text,
  add column emoji text;
```

`kind` resta popolato per una release come ponte, poi si toglie. L'identità passa a `folders.id`:

- route `/folder/[kind]` → `/folder/[id]`, idem `folder-settings?kind=` → `?id=`
- `lib/folder-order-store.ts` memorizza id
- `ITEM_TYPES_BY_KIND` → `ITEM_TYPES_BY_CATEGORY` (i tipi di elemento dipendono dalla
  macrocategoria: per Lingue parola/verbo/frase/grammatica; per Materie termine/concetto/definizione/data;
  ecc.)
- `FolderTile` legge `emoji` dalla riga; la catena di `if` sparisce

Backfill: `jp → (lingue, jp, 🇯🇵)`, `es → (lingue, es, 🇪🇸)`, `medicine → (materie, medicina, 🩺)`,
`law → (materie, diritto, ⚖️)`, `custom → (custom, null, 📁)`.

~15 file toccati. È inevitabile: la tassonomia richiesta ha ~45 voci contro le 5 rappresentabili oggi.

### Tassonomia

`lib/folder-taxonomy.ts`, dato puro, etichette via i18n.

**🌍 Lingue** — Giapponese · Spagnolo · Francese · Italiano · Portoghese · Tedesco · Coreano ·
Arabo · Russo · Hindi · Cinese · *Altra lingua*

**📚 Materie** — Psicologia · Medicina · Diritto · Finanza · Marketing · Management · Fisica ·
Chimica · Geografia · Storia · Filosofia · *Altra materia*

**🧑‍💼 Lavoro e professione** — 💼 Business · 💻 Programmazione · 📊 Marketing · 💰 Contabilità ·
🏥 Sanità · 👩‍🏫 Insegnamento · 🏨 Turismo · 🍽️ Ristorazione · 🏗️ Ingegneria · 🧑‍⚖️ Settore legale ·
*Altro*

**🎯 Interessi** — 🌍 Geografia · 🏛️ Storia · 🎨 Arte · 🎵 Musica · 🎬 Cinema · 📚 Letteratura ·
🧠 Psicologia · 🔬 Scienza · 🌱 Natura · 🍷 Vino · 🍳 Cucina · 🏃 Sport · *Altro interesse*

"Esami e certificazioni" è **escluso** su indicazione di Angelo. Alcuni nomi ricorrono in due
macrocategorie (Marketing, Psicologia, Geografia, Storia): è voluto, inquadrano cose diverse.
Tolto `unique(user_id, kind)`, due cartelle omonime sono possibili e accettabili.

### Schermata "Nuova cartella"

Titolo: **"Cosa vuoi ricordare?"** (oggi "Scegli il tuo argomento" / "Nuova cartella",
`choose-topic.tsx:236`).

Corpo: quattro card grandi 2×2 — Lingue / Materie / Lavoro / Interessi — con emoji, nome e una riga
di esempio.

Tocco su una macrocategoria → **bottom sheet**, riusando la shell già collaudata di `MoveSheet`
(warmWhite, raggi superiori 22, grabber 36×4, backdrop `rgba(15,27,51,0.32)`):

- campo di ricerca in cima, filtra mentre si scrive
- lista scorrevole delle sottocategorie, emoji + nome
- in fondo la voce *"Altra lingua…"* / *"Altra materia…"* → campo nome libero

In fondo alla schermata principale, al posto dell'attuale card "Altro…": un box **"Crea cartella
personalizzata"** con sottotitolo *"Dai un nome a qualsiasi cosa tu voglia ricordare"*.

Il percorso di onboarding continua a usare la stessa schermata (oggi senza via d'uscita); il
box personalizzato gli dà una scappatoia che oggi manca.

---

# PARTE II — IL RESTO

## B1. Micro-fix

### 1. Limite 50 caratteri sul termine

`app/add.tsx:324-346` non ha `maxLength` né contatore. La colonna `memories.term` è `text` senza
limite; l'anteprima tronca a 60 solo per la visualizzazione.

`maxLength={50}` (limite duro) + contatore `n / 50` allineato a destra, visibile **dai 40
caratteri in su**, rosso a 50. Il precedente per lo stile è il contatore di `choose-topic`.
Chiave nuova: `add.termCounter`.

### 2. "Frase d'esempio o curiosità (opzionale)"

`it.ts:42-43`. Cambiano sia `add.exampleLabel` sia `add.examplePlaceholder`, in tutti e quattro i
cataloghi (`i18n.test.ts` impone la parità delle chiavi):

- IT — "Frase d'esempio o curiosità" / "Frase d'esempio o curiosità (opzionale)"
- EN — "Example sentence or fact" / "Example sentence or fact (optional)"
- ES — "Frase de ejemplo o curiosidad" / "Frase de ejemplo o curiosidad (opcional)"
- FR — "Phrase d'exemple ou anecdote" / "Phrase d'exemple ou anecdote (facultatif)"

### 3. "Mostra risposta" sopra la barra di navigazione

`useSafeAreaInsets` è usato in **due soli file** dell'intera app (`app/(app)/_layout.tsx:19` e
`app/(admin)/_layout.tsx:20`) e nessuno dei due è una schermata di ripasso. Tutte le schermate di
ripasso usano `SafeAreaView edges={["top"]}` e un `paddingBottom: 32` fisso.

`app.json:32` ha `"edgeToEdgeEnabled": true`: l'app disegna sotto la barra di sistema. Una barra a
tre pulsanti è ~48 dp, quindi 32 dp non basta — il bottone da 60 px finisce sotto. Con la
navigazione a gesti (~24 dp) passa per un pelo. Ecco perché succede sul telefono di Maurizio e non
sul tuo.

Fix: `Math.max(insets.bottom, 32)` in `focus.tsx:172`, `reinforcement.tsx:215`, `scan.tsx:357`,
`complete.tsx:220`. È l'unico precedente esistente nel codice (`(app)/_layout.tsx:57`), quindi
diventa la regola.

Nota a margine emersa dalla mappatura: "Mostra risposta" è alto **54** in Focus (`PrimaryButton`) e
**60** in Reinforcement (un `Tappable` grezzo, duplicato in due stadi). Vanno uniformati mentre si
è lì.

### 4. A capo del termine — la parola intera fino a 12 lettere

**Causa esatta.** `lib/term-typography.ts:38` assume che **ogni minuscola valga 0.58 em**. Nel file
Inter Bold effettivamente spedito le larghezze reali sono:

```
e 0.596   m 0.913   b 0.630   a 0.581   r 0.407   g 0.632   o 0.613
i 0.271   l 0.271   c 0.588   s 0.560   n 0.623   d 0.630
```

"embargo" misura **4.192 em** reali contro **3.880** stimati — l'errore è tutto nella `m`, che vale
il 57% in più di quanto il modello creda. Su un telefono da 360 dp la scatola è 296 px, il modello
sceglie 76 px, e a 76 px la parola occupa **318,6 px**: 22,6 px di troppo. Deve andare a capo per
forza.

Il paracadute poi è configurato per **permettere** la rottura invece di impedirla: una parola
singola riceve sempre `numberOfLines={2}` (`term-typography.ts:89-95`), quindi per React Native
"embarg / o" **è** un fit valido e non rimpicciolisce mai. `minimumFontScale` non è impostato in
nessun punto dell'app, e sotto la New Architecture verrebbe comunque ignorato. Il test a
`term-typography.test.ts:58-60` sancisce il comportamento di proposito: *"a mid-word wrap beats
clipping"*.

Il modello sbaglia in entrambe le direzioni: "biblioteca" è stimata il 22% più larga del vero e
viene quindi resa più piccola del necessario.

**Fix in tre parti:**

1. Tabella di metriche reali estratte da `Inter_700Bold.ttf` per l'intervallo latino, con un
   fallback per gli altri script. Sostituisce le sette costanti per classe di carattere.
2. Parola singola → `numberOfLines={1}`, con `FLOOR_SINGLE_WORD = 26`. Il caso patologico
   (12 caratteri tutti `m` = 10,63 em) a 26 px occupa 276 px contro una scatola da 296: **ci sta**.
   Solo se nemmeno al floor la parola entra si concedono 2 righe.
3. Test che asserisce la regola richiesta: **nessuna parola singola fino a 12 caratteri va a capo**,
   su un insieme di casi peggiori (`mmmmmmmmmmmm`, `embargo`, `commercio`, `wwwwwwwwwwww`) e su
   tutte le larghezze di schermo reali (320 / 360 / 393 / 412 dp) e per tutti e tre i layer.

Il test rimpiazza quello a `term-typography.test.ts:58-60`, che asseriva il comportamento vecchio.

Nota: lo stesso termine appare a 84 px sulla card Scan e a 56 px nel lampo di conferma
(`scan.tsx:298` vs `:179`) — visibilmente diverso. Da uniformare mentre si è lì.

### 5–6

"Via i 3 × 48h" e "Vedi ripassi successivi" riguardano il mockup, non codice esistente: confluiscono
in B3.

---

## B2. Nuova cartella

Coperta da F4.

---

## B3. Home ridisegnata + calendario

### Cosa c'è oggi

`app/(app)/today.tsx`, 265 righe: intestazione con saluto e mascotte · `TimeBudgetChips`
("Quanto tempo hai oggi?") · "FLUSSO CONSIGLIATO" con le tre `LayerCard` Scan/Reinforcement/Focus ·
riga di totale e CTA "Inizia il ripasso di oggi".

**Non esistono** una sezione "Prossimi ripassi", un elenco di cartelle sulla Home, una sezione
"Da recuperare", né alcun cerchio o avatar a sinistra. Non esiste nessun componente calendario in
tutto il repo, e nessuna dipendenza ne fornisce uno.

### Struttura nuova

Dal mockup, in palette chiara (e scura, grazie a F1):

1. **Intestazione** — invariata. Saluto su due righe, kicker data, mascotte a destra: coincide già
   con il mockup.
2. **"Ripassi di oggi"** → card hero: a sinistra un **cerchio con il numero** (il mockup ha lì dei
   quadrati sovrapposti che, come da tua indicazione, non c'entrano nulla); a destra "N ricordi da
   ripassare" e "N cartelle · circa N min"; sotto, il CTA "Inizia il ripasso" a tutta larghezza
   dentro la card.
3. **"Da recuperare"** — solo se ci sono elementi in ritardo. Icona orologio su pastiglia rossa,
   "N ricordi in ritardo", sottotitolo "Spagnolo · previsti ieri", chevron. Definizione: post-F2
   "in ritardo" = `effective_state = 'fading'`, cioè finestra scaduta. È un concetto che **oggi
   non esiste** nel modello dati e che F2 rende esprimibile.
4. **"Oggi"**, con **"in base alle tue priorità"** allineato a destra sull'intestazione di sezione.
   Righe cartella: tessera emoji, nome, a destra "N ricordi" e chevron. **Nessun sottotitolo
   "3 × 48h"** — rimosso come da indicazione.
5. **"Prossimi ripassi"** — "Domani · N ricordi", il giorno successivo, poi come ultima riga
   **"Vedi ripassi successivi"** (al posto della terza data).
6. Le `TimeBudgetChips` e "Flusso consigliato" **restano**: il CTA promette un piano
   (`layerCaps`) che dipende dai tre numeri per layer, quindi togliere quel blocco romperebbe la
   promessa del bottone. Si spostano sotto la card hero.

### Calendario

Nuova schermata `app/(app)/upcoming.tsx`: griglia mensile a 7 colonne costruita a mano (~150
righe), ogni cella col numero di ricordi in scadenza quel giorno; frecce mese precedente/successivo.

Tocco su un giorno → sheet con i ricordi di quel giorno → tocco su un ricordo → `/memory/[id]`.
È esattamente il percorso richiesto.

### Dati

Serve una previsione per giorno che **oggi non esiste**: ogni query di scadenza in `lib/api.ts` è
`.lte("next_review_at", nowIso)` (righe 519, 813, 865), nulla raggruppa per giorno, e nelle 13
migrazioni non c'è alcuna vista o aggregato.

Nuova `fetchUpcomingCounts(userId, fromISO, toISO)`: seleziona `next_review_at` delle righe vive,
non archiviate, in cartelle non in pausa, dentro l'intervallo, e le raggruppa **per giorno locale**
lato client. L'indice `memories_user_next_review_idx (user_id, next_review_at)` copre la query. Per
i volumi di un'app personale (centinaia di righe) non serve un aggregato server-side; se un giorno
servirà, la firma non cambia.

**Confine di giornata:** oggi l'app è incoerente — `api.ts` usa `now.toISOString()` per la
scadenza, mentre `lib/format.ts:75-77` e `api.ts:372-376` usano la mezzanotte **locale**. Il
calendario adotta la **mezzanotte locale**, ed è quella che governa anche il raggruppamento di
"Prossimi ripassi". È l'unica scelta che non fa apparire un ricordo nella casella del giorno
sbagliato per chi vive a est o a ovest di Greenwich.

Serve anche `fetchDueByFolder(userId)` per la sezione "Oggi": `fetchDueCounts` accetta già un
`folderId` opzionale, quindi o si fa fan-out o si aggiunge una query raggruppata. Preferibile la
seconda.

---

## B4. Piani, limiti, mascotte

### Stato attuale

**Non esiste nessun paywall e nessun piano a pagamento nel binario.** `react-native-purchases` non
è una dipendenza. `app/(app)/subscribe.tsx` è stato **cancellato** il 29/08 (commit `3cd141e`) —
apriva un checkout esterno con `Linking.openURL`, cioè esattamente il rischio di rifiuto Apple
3.1.1 / Play Payments. **Quel rischio non è più nel binario.** `PREMIUM_ENABLED` sopravvive in
`constants.ts:235` ma è importato da **zero** file: è un flag orfano.

Non esiste alcuna colonna di abbonamento in nessuna delle 13 migrazioni.

I tre limiti attuali, nessuno consapevole del piano:

- **Cartelle** — `FREE_FOLDER_LIMIT = 1` è **codice morto**, non referenziato da nulla. Il tetto
  reale è 5, ottenuto per aritmetica lato client più `unique(user_id, kind)`.
- **Ricordi al giorno** — `daily_input_cap` default 20, **avviso morbido mai bloccante**
  (`add.tsx:143-144`, testuale). Solo lato client. E la migrazione `lock_profiles_columns` mette
  `daily_input_cap` **tra le colonne che l'utente può scrivere da sé**: chiunque può portarselo a
  200 con una chiamata PostgREST.
- **Sottocartelle** — max 3, ed è l'**unico** limite con vera applicazione server-side (trigger
  `enforce_subfolder_rules`, errcode `P0003`).

### I piani

| | Free | Pro | Premium |
|---|---|---|---|
| Ricordi | **10 totali** | illimitati | illimitati |
| Cartelle | 1 | 5 | illimitate |
| Sezioni per cartella | 0 | 3 | illimitate |
| Foto sui ricordi | — | — | ✓ |
| Statistiche avanzate | — | — | ✓ |

Due precisazioni sulla tabella, perché entrambe sono sottrazioni rispetto a oggi:

- **Sezioni**: oggi le sottocartelle sono attive per tutti (`SUBFOLDERS_MAX = 3`, senza controllo di
  piano), pur essendo state pensate come funzione Pro (`constants.ts:22-25`). Portarle a 0 nel
  piano free toglie qualcosa che le persone hanno già. Il grandfathering copre il caso: le sezioni
  esistenti restano e restano usabili, non se ne possono creare di nuove.
- **"Statistiche avanzate"** non è ancora definita e **non entra in questo ciclo**. La schermata
  Progressi resta uguale per tutti i piani finché non decidiamo cosa contiene la versione avanzata.
  L'ho lasciata in tabella perché è la voce che giustifica lo scarto di prezzo tra Pro e Premium
  nella comunicazione, ma va progettata a parte prima di poter essere venduta.

Prezzi, durata e periodo di prova non sono in questa spec: sono configurazione RevenueCat e non
cambiano una riga di codice.

I **10 ricordi del piano free sono un tetto totale**, non giornaliero. Il cursore regolabile in
Impostazioni — quello con gli avvisi della mascotte — è un limite **giornaliero** e riguarda solo
Pro e Premium: è uno strumento di autoregolazione del carico, non un confine commerciale. Un utente
free non lo incontra mai, perché esaurisce i 10 ricordi totali molto prima.

### Schema

```sql
alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free','pro','premium')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;
```

**Nessuna delle tre va nella grant di UPDATE per `authenticated`** — `docs/PAYMENTS.md:116-124` e
`docs/DATA-MODEL.md:260-262` lo prescrivono già, ed è la lezione diretta di `daily_input_cap`, che
è scrivibile dall'utente e quindi inutile come limite.

### Applicazione server-side

Trigger `BEFORE INSERT` su `memories`: se `plan = 'free'` e il conteggio delle righe vive
dell'utente è ≥ 10, solleva un errore con errcode dedicato. Il **grandfathering cade fuori
gratis**: chi ha già 40 ricordi li tiene tutti e semplicemente non può aggiungerne — che è
esattamente la semantica scelta.

Trigger analogo su `folders` per il tetto per piano. `enforce_subfolder_rules` diventa consapevole
del piano.

Il client rispecchia i limiti per l'UX (disabilita, spiega, propone l'upgrade) ma **la verità è nel
database**. Gli errcode vanno mappati per codice, non per sottostringa del messaggio — oggi
`folder/[kind].tsx:514` fa `msg.includes("limit")`, che si rompe appena cambia una traduzione.

### RevenueCat

`react-native-purchases` → modifica nativa, stessa build di F1/F3/B5. Entitlement `pro` e
`premium`. Sincronizzazione: il client legge l'entitlement e chiama una edge function che
**verifica con l'API REST di RevenueCat** prima di scrivere `profiles.plan`. Il client da solo non
è una fonte attendibile per un permesso.

Qualsiasi codice che tocchi l'SDK deve diramare su `isDemoMode` prima della prima chiamata
(`docs/PAYMENTS.md:170-171`), altrimenti la modalità demo si rompe.

"Ripristina acquisti" va sul paywall **e** in Impostazioni (`PAYMENTS.md:153-155`); la sezione
abbonamento in Impostazioni oggi non esiste più e va ricreata.

### Gli avvisi della mascotte

Nessun componente mascotte-con-messaggio esiste: `CoachTip` è codice morto (importato da nulla),
`MascotLoader` serve solo al caricamento, e `Mascot` è esplicitamente decorativo
(`accessibilityElementsHidden`, quindi **il messaggio deve stare in un testo fratello** o gli screen
reader non lo leggono).

Nuovo `MascotDialog`: sheet dal basso sul modello di `settings.tsx:501-599`, con `Mascot`
`variant="investigate"`, titolo, corpo, e i due bottoni. Compare quando un utente Pro o Premium
alza il cursore del limite giornaliero in Impostazioni.

Soglie e copy:

- **20** — "Il carico inizia a essere pesante… Sicuro di poterlo reggere?"
- **25** — "Venticinque parole al giorno sono tante. Tra una settimana sono centosettantacinque
  ricordi che tornano: regge il tuo ritmo?"
- **30** — "Carico molto alto. A trenta parole al giorno i ripassi si accumulano più in fretta di
  quanto riesci a smaltirli: tra un mese potresti ritrovarti centinaia di ricordi in coda ogni
  giorno, e il modo più veloce per smettere di ripassare è avere troppo da ripassare."

La riga del limite giornaliero (`settings.tsx:328-334`) passa da sola lettura a interattiva, e
`updateProfile` accetta già `dailyInputCap` (`api.ts:71,76`) — non lo chiama nessuno.

---

## B5. Foto sui ricordi (Premium)

### Stato attuale

Non esiste nulla. `expo-image-picker` non è installato, non ci sono bucket Storage in nessuna
migrazione, `supabase.storage` non è mai referenziato, `memories` non ha colonne media, e
`app.json` non dichiara né `NSPhotoLibraryUsageDescription` né `NSCameraUsageDescription`. Le uniche
tracce sono due TODO: `docs/DATA-MODEL.md:212` e `20260825152550_delete_own_account.sql:20-21`.

### Design

Bucket privato `memory-photos`, RLS su `owner = auth.uid()`. Colonna `memories.photo_path text`.

Il `+` sta **in basso a destra dentro il box "Cosa significa"**, come richiesto — e coincide con il
design approvato ad agosto ("foto solo sul retro"), perché quel box **è** il retro della card.

Meccanicamente: oggi i quattro input sono `TextInput` nudi, fratelli diretti di un unico `View`
(`add.tsx:323`), senza alcun contenitore posizionato a cui ancorare un bottone flottante. Serve
avvolgere il campo significato in un `View` relativo, dare all'input `paddingBottom: 44` così il
testo non scorre mai sotto il bottone, e posizionare un `Tappable` 36×36 a `right: 8, bottom: 8`.
Senza il padding, appena l'utente scrive tre righe il testo finisce sotto il pulsante.

Tocco → sheet Fotocamera / Libreria / Rimuovi.

**Caricamento al salvataggio, non alla scelta** — altrimenti chi abbandona la schermata lascia file
orfani nel bucket. Se la riga si salva ma il caricamento fallisce, la riga resta e si avvisa:
perdere il testo per colpa di una foto sarebbe il peggiore dei due esiti.

La foto compare sul **retro**: anteprima in Add, scheda del ricordo, e pannello di rivelazione di
tutte e tre le schermate di ripasso.

`delete_own_account` deve ripulire `storage.objects` — già segnalato in `DATA-MODEL.md:212` e oggi
non fatto: senza, cancellare l'account lascia le foto sul server.

---

# Ordine di esecuzione

Angelo ha scelto "prima le fondamenta".

**Blocco nativo** — una sola build, perché ognuna di queste cambia il fingerprint e quindi il
runtime: `userInterfaceStyle: "automatic"` (F1) · plugin `expo-notifications` (F3) ·
`expo-image-picker` (B5) · `react-native-purchases` (B4) · icona v2 (già approvata, in attesa) ·
Sentry (già in sospeso). Vanno raggruppate: ogni build separata scollega tutti i binari in
circolazione dalle OTA successive.

| # | Lavoro | Nativo? | Dipende da |
|---|---|---|---|
| 0 | vc12 su Play + correzione di DEPLOY.md | no | — |
| 1 | F2 scheduler a fasi + migrazione | no (OTA) | — |
| 2 | F4 cartelle da kind a id + tassonomia | no (OTA) | — |
| 3 | F1 tema chiaro/scuro | **sì** | — |
| 4 | F3 notifiche + schermata orario | **sì** | F2 |
| 5 | B1 micro-fix | no (OTA) | — |
| 6 | B2 schermata Nuova cartella | no (OTA) | F4 |
| 7 | B3 Home + calendario | no (OTA) | F1, F2 |
| 8 | B4 piani + paywall + mascotte | **sì** | — |
| 9 | B5 foto | **sì** | B4 |

I punti 3, 4, 8 e 9 condividono **una sola build nativa**, da fare quando tutti e quattro sono
pronti.

Questa spec **non diventa un unico piano di implementazione**: è troppo grande. Ogni riga della
tabella riceve il proprio piano quando tocca a lei, così ogni blocco si può rivedere, spedire e
correggere per conto suo invece di arrivare tutto insieme alla fine.

# Rischi

1. **Il tema è il pezzo più grande.** ~40 file, e ogni uso di `colors` a livello di modulo si
   congela sulla palette di boot. Va censito prima di cominciare.
2. **Nessun binario Android riceve OTA finché vc12 non è su Play.** Vale per ogni riga di questa
   spec.
3. **La migrazione delle cartelle tocca le route.** Un utente con l'app aperta su
   `/folder/jp` durante l'aggiornamento OTA finisce su una route che non esiste più: serve un
   redirect di compatibilità per una release.
4. **Il backfill dello scheduler toglie dalla coda di oggi** i ricordi aggiunti nelle ultime 20 ore.
   Corretto, ma va annunciato a Maurizio prima, o sembra un guasto.
5. **L'archiviazione automatica a 48h è irreversibile se sbagliamo**: per questo gli archiviati
   devono avere una lista e un ritorno con un tocco, prima che il trigger entri in funzione.
6. **`daily_input_cap` è scrivibile dall'utente.** Qualunque limite che ci si appoggi è
   decorativo finché non si toglie dalla grant.
7. **AGENTS.md vieta il tema scuro.** Va aggiornato nello stesso commit, o il prossimo agente
   che legge le regole disfa il lavoro.
