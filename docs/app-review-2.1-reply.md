# Risposta ad App Review — Guideline 2.1, Information Needed

> Rifiuto del 2026-09-05 sulla versione 1.0 / build 3. Motivo unico:
> `2.1.0 Performance: App Completeness`, nella variante "New App Submission —
> This app has been submitted by a developer account that has a limited App
> Review history". Non è un difetto dell'app: Apple chiede di capire cosa fa
> prima di approvarla.
>
> I fatti qui sotto sono stati verificati sul codice e, dove possibile, sul
> binario spedito (`builds/memika-ios-build3-2026-09-04.ipa`) e sulla
> configurazione di produzione, non sulla documentazione — che in due punti
> era già superata. Ogni affermazione è stata poi ricontrollata da un
> verificatore indipendente.

## Come si risponde

1. **Centro Risoluzioni** di App Store Connect → rispondi al messaggio di
   Apple incollando il testo della sezione "Testo per il Centro Risoluzioni".
2. **Stessa cosa nel campo Note** delle informazioni per la verifica
   (App Store Connect → Versione → Informazioni per la verifica dell'app →
   Note). Apple lo chiede esplicitamente: «add this information to the Notes
   field … for reference on future submissions». Serve a non farsi
   rifare la stessa domanda alla prossima versione.
3. **Allega il video** (vedi la scaletta più sotto).
4. **Invia di nuovo al team di verifica**.

---

## Testo per il Centro Risoluzioni

> In inglese: è la lingua in cui Apple ha scritto e in cui risponderà.

```
Thank you for the review. Below is the information requested, in the same
order as your message. We have also added it to the Notes field of the App
Review Information section.

1. SCREEN RECORDING

A screen recording captured on a physical iPhone running the latest iOS is
attached. It starts from launching the app and shows the typical user flow,
including account registration, sign-in, and account deletion.

Regarding the other items you list for the recording:

- User-generated content: the app does contain user-generated content, but it
  is strictly private. Everything a user writes (memories, folders, sections)
  and every photo they attach is visible only to that user's own account.
  There is no sharing, no publishing, no feed, no public profile, no comments,
  no leaderboard, no collaborative folder and no shareable link anywhere in the
  app. This is enforced by the database, not only by the interface: every table
  has row-level security restricting rows to the authenticated user, and photos
  are kept in a private storage bucket, readable only through short-lived
  signed URLs scoped to that user's own folder. Because no user can ever see
  another user's content, there is no surface on which content reporting or
  blocking mechanisms would operate, and the app therefore does not include
  them.

- Paid content or features: this version has no in-app purchases. No purchase
  screen is reachable, and no product is configured. See point 4 below.

2. PURPOSE AND TARGET AUDIENCE

Memika is a spaced-repetition study app. It solves a specific problem: people
study something once and then forget it, because they never review it at the
moment it is about to fade.

The user saves what they want to remember — a word, a term, a concept — with
its meaning and an example. From then on the app schedules the review for
them. Each review session runs through three fixed phases, always in the same
order: Scan (a quick check), Reinforcement (a hint before the answer, for
material seen in the last few days) and Focus (the full review, where the user
decides whether they remembered it).

The target audience is people who study on their own and need to retain what
they have learned: language learners, university students, and professionals
preparing exams in fields such as medicine or law. The app is rated 17+ and our
published Terms reserve it to users aged 16 and over.

The value is deliberately calm: no streaks, no leaderboards, no advertising,
no notifications designed to create pressure. It is a quiet place to return to
for a few minutes a day.

3. SETUP AND ACCESS

The whole app is behind an account; there is no guest mode. A demo account is
provided in App Review Information:

  Email:    memikaapp+review@gmail.com
  Password: Memika2026!

That account is ready to review: it contains one folder ("Spagnolo") with six
memories, all of them already due, so the review flow can be started
immediately. No sample files are needed.

To see the main features:
  - Open the app and sign in with the credentials above.
  - "Oggi" (Today) is the home screen. Tap "Inizia il ripasso" (Start today's
    review) to run the three phases: Scan, Reinforcement, Focus.
  - "+" (Add) creates a new memory. A photo can be attached from the "+" button
    in the meaning field, using either the camera or the photo library.
  - "Cartelle" (Folders) groups memories by topic.
  - "Salute della memoria" (Memory health) shows which memories are stable and
    which are fading.
  - Account deletion is in "Impostazioni" (Settings), under the section named
    "Zona pericolosa" (Danger zone), as "Elimina account" (Delete account).
    Please do not run it on the demo account.

The app interface is available in Italian, English, French and Spanish, and
follows the device language automatically.

4. EXTERNAL SERVICES, TOOLS AND PLATFORMS

At runtime this build contacts exactly three external services:

  - Supabase (Supabase Inc.) — the app's only backend. It provides
    authentication (email and password only), the PostgreSQL database holding
    the user's memories and folders, and private file storage for the photos
    attached to memories. The project is hosted in the EU (eu-central-1,
    Frankfurt).

  - Expo EAS Update (Expo / 650 Industries) — over-the-air updates of the
    JavaScript bundle. The app checks for an update on launch. We use it only
    for fixes and improvements within the scope and functionality of the
    reviewed binary.

  - Resend — used server-side as the SMTP provider for Supabase's
    authentication emails (password reset, email change). The app itself never
    contacts Resend; Supabase does, on our behalf.

Two SDKs are compiled into the binary but are completely inert in this build,
and we want to state this explicitly so that their presence in the binary does
not appear to contradict our answers:

  - RevenueCat — the in-app purchase SDK. This build ships with no API key, so
    it is never initialised and no purchase can be made. See point 6.

  - Sentry — crash reporting. This build ships with no DSN, so the SDK
    initialises into a no-op and no data is sent anywhere.

For completeness, what the app does NOT use:

  - No artificial intelligence or machine learning service of any kind. There
    is no AI dependency in the project, no inference endpoint, and no
    server-side function deployed. The review scheduling is a deterministic
    algorithm that runs on the device; no user content is ever sent to any
    model or to any third party for processing.
  - No analytics, no advertising SDK, no tracking, and no advertising
    identifier. The privacy manifest declares NSPrivacyTracking as false.
  - No remote push notifications. The app schedules LOCAL notifications on the
    device only. (The provisioning profile carries the push entitlement, but
    the app never registers for remote notifications and no push server exists.)
  - No social or third-party sign-in, and therefore no requirement for Sign in
    with Apple.
  - No payment processor of any kind, and no external purchase flow.

5. REGIONAL DIFFERENCES

There are none. The app behaves identically in every region.

The only thing that varies is the language of the interface, which follows the
device language among Italian, English, French and Spanish (any other language
falls back to English), and can be overridden by the user in Settings. All four
catalogues are complete, so no screen is left untranslated in one language and
translated in another.

There is no logic anywhere in the app that depends on country, region,
storefront or currency; the app does not request or use location; and the
database schema has no country or region column. The material being studied is
written entirely by the user, so there is no region-specific content to differ.

6. REGULATED INDUSTRY OR PROTECTED THIRD-PARTY MATERIAL

Neither applies.

Memika does not operate in a regulated industry. It is a general-purpose study
tool: users can use it to study medicine or law, but the app provides no
medical, legal or financial information of its own and gives no advice. Every
piece of content in a user's account was typed there by that user.

The app contains no third-party protected material. All artwork, including the
mascot and the icon, was created for this app. The only third-party components
are the open-source libraries listed in point 4, used under their own licences.

Finally, regarding the in-app purchase note in your message: this version
deliberately ships with no in-app purchases. No subscription product is
configured in App Store Connect, no purchase screen is reachable in the app,
and the Subscription section of Settings is not displayed at all. The app is
fully usable, with no limits the reviewer can encounter, without paying
anything. We are completing the Paid Applications agreement now, and
subscriptions will be submitted together with a future version of the app, as
your guidelines require.

Thank you for your time.
```

---

## Scaletta del video

Registrazione schermo **su iPhone fisico**, con l'ultima versione di iOS, sulla
**build che poi invii** (build 5). Apple chiede che parta dal lancio dell'app.

Durata ragionevole: 3-5 minuti. Nessun montaggio, nessuna musica, nessun testo
sovrapposto: vogliono vedere l'app, non un trailer.

| # | Cosa mostrare | Perché |
|---|---|---|
| 1 | **Lancio dall'icona sulla home** | «The recording must begin with launching the app» |
| 2 | **Registrazione**: crea un account nuovo con un indirizzo qualunque | Chiesta esplicitamente. Nota: **non arriva nessuna email di conferma** — la verifica è disattivata sul server, quindi si entra subito. Non dire in giro il contrario |
| 3 | Il carosello di benvenuto e la **scelta della prima cartella** | È il flusso reale del primo accesso |
| 4 | **Aggiungi un ricordo** (termine, significato, esempio) | È il contenuto generato dall'utente |
| 5 | **Allega una foto** dal "+" nel campo significato | Apple vuole vedere i contenuti utente, e qui compare la finestra di permesso |
| 6 | **Esci** e **rientra** con l'account demo `memikaapp+review@gmail.com` | Mostra l'accesso e dimostra che le credenziali date funzionano |
| 7 | **Oggi → Inizia il ripasso**: le tre fasi Scan, Reinforcement, Focus | È il cuore dell'app, e la parte che spiega a cosa serve |
| 8 | **Cartelle** e **Salute della memoria** | Le altre due superfici principali |
| 9 | **Impostazioni → Zona pericolosa → Elimina account**: apri la conferma, **poi annulla** | Apple verifica SEMPRE che l'eliminazione esista. Mostrala sull'account creato al punto 2, non sul demo |

Cosa **non** mostrare, perché non esiste in questa build: paywall, abbonamenti,
acquisti. Se il revisore non li vede è coerente con quanto dichiarato.

---

## Tre cose da NON scrivere ad Apple

Sono errori che l'audit ha trovato nella documentazione interna, e che
finirebbero nella risposta se qualcuno la scrivesse leggendo i `docs/`:

1. **Non dire «le email partono dal mittente di Supabase».** Non è più vero dal
   4 settembre: il progetto usa un SMTP personalizzato su Resend, mittente
   `Memika <noreply@memika.eu>`, con tetto di 60 email/ora. `docs/EMAILS.md` e
   `docs/DEPLOY.md` descrivono ancora la configurazione vecchia.
2. **Non dire «abbonamenti in-app tramite RevenueCat»** al presente. In questa
   build non c'è chiave, il paywall non è raggiungibile e nessun prodotto
   esiste su App Store Connect. Descriverlo come attivo è esattamente la
   "funzionalità segnaposto" che fa scattare la 2.1.
3. **Non dire «nessuna notifica push».** Il profilo di provisioning dichiara
   `aps-environment`. La frase esatta è «nessuna notifica push REMOTA: solo
   notifiche locali programmate sul dispositivo».
