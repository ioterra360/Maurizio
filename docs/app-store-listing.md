# Scheda App Store — Memika

> Pacchetto per App Store Connect (2026-08-29). Bozze da approvare prima di
> incollarle. Stessi contenuti della scheda Play (`docs/store-listing.md`),
> adattati ai campi e ai limiti di Apple. Regola: niente trattini lunghi nei
> testi italiani; niente riferimenti ad altre piattaforme nei testi iOS.

## Stato account (chi fa cosa)

| Passo | Dove | Chi |
|---|---|---|
| Stato operatore commerciale (DSA): "Sono un operatore commerciale", indirizzo Viale Mons. Peri 2, 09170 Tresnuraghes (OR), telefono pubblico, memikaapp@gmail.com; confermare i codici SMS + email | ASC → Azienda → Conformità | Maurizio |
| Accettare l'ultimo Program License Agreement se compare il banner | developer.apple.com → Account → Agreements | Maurizio |
| App ID `studio.tailor.memika` (Explicit, Push Notifications + In-App Purchase) | developer.apple.com → Identifiers | fatto 2026-08-29 |
| Record app "Memika" (iOS, Italiano, SKU `memika`) | ASC → App → Nuova app | Angelo (2026-08-29) |
| Chiave API `EAS`, accesso Admin (con accesso a Certificati) → Issuer ID + Key ID + `.p8` | ASC → Utenti e accessi → Integrazioni | Maurizio/Angelo |
| Invito acasula97@gmail.com come Amministrazione, tutte le app | ASC → Utenti e accessi → Persone | Maurizio |
| Team ID | `DT6SV2JMV3` | noto |

Con la chiave API: `eas credentials -p ios` (carica la chiave, EAS crea certificato di
distribuzione e profilo), poi `eas build --profile production --platform all`
(iOS 1 + Android vc12 dallo stesso commit, così i due store condividono gli OTA),
`eas submit -p ios` (serve `ascAppId`: ASC → App → Informazioni app → ID Apple),
TestFlight interno per Angelo + Maurizio.

## Informazioni app

| Campo | Valore |
|---|---|
| Nome | Memika |
| Bundle ID | studio.tailor.memika |
| SKU | memika |
| Lingua principale | Italiano |
| Categoria principale | Istruzione (Education) |
| Categoria secondaria | Produttività (facoltativa) |
| Diritti sui contenuti | Non contiene, mostra o accede a contenuti di terze parti |
| Classificazione per età | Questionario: nessun contenuto (violenza, sesso, linguaggio, droghe, gioco d'azzardo, horror, accesso web illimitato, concorsi, contenuti utente condivisi, informazioni mediche) → calcola 4+. **Decisione consigliata:** impostare il limite minimo a **16+** con l'opzione a fine questionario, così App Store = Play (16-17 e 18+) = Termini di servizio. |
| Prezzo | Gratis, tutti i paesi |
| Copyright | 2026 Maurizio Cocco |
| URL assistenza | https://ioterra360.github.io/memika-legal/ |
| URL marketing | (vuoto) |
| URL informativa privacy | https://ioterra360.github.io/memika-legal/privacy/ |
| iPad | no (solo iPhone, `supportsTablet: false`), niente screenshot iPad |
| Screenshot iPhone 6.7"/6.9" | `docs/store-assets/screenshots/iphone-6.7/01..08` (it), `-en`, `-fr`, `-es` (1290×2796) |
| Export compliance | `ITSAppUsesNonExemptEncryption: false` già nell'Info.plist: nessuna domanda al caricamento |

## Privacy dell'app (etichetta "nutrition label")

Il binario raccoglie dati account, contenuti e — dalla build 3 — le foto che
l'utente sceglie di allegare a un ricordo, tutto tramite Supabase. Sentry è
disattivato (DSN vuoto), nessuna pubblicità, nessuna analytics, nessun tracking.
La riga "Foto o video" va compilata **prima di sottomettere la build 3**:
un'etichetta privacy che non dichiara una raccolta che avviene ricade sotto le
Linee guida 5.1.1(i) / 5.1.2, e la stessa raccolta è dichiarata nell'informativa
pubblicata (`docs/legal/privacy.html` §3) — le due devono coincidere (2.3.1).

**Raccogli dati?** Sì.

Dati **collegati all'utente**, finalità **Funzionalità dell'app**, non usati per il tracciamento:

| Categoria | Tipo | Note |
|---|---|---|
| Informazioni di contatto | Indirizzo email | account |
| Informazioni di contatto | Nome | nome visualizzato (facoltativo) |
| Contenuti dell'utente | Altri contenuti dell'utente | ricordi, cartelle, appunti |
| Contenuti dell'utente | Foto o video | foto allegate a un ricordo (facoltative, piano Premium; bucket privato, URL firmati) |
| Dati di utilizzo | Altri dati di utilizzo | esiti dei ripassi (pianificazione) |
| Identificatori | ID utente | uid Supabase |

Nessun dato usato per pubblicità di terzi, analytics o tracciamento. Quando Sentry
sarà attivo aggiungere: Diagnostica → Dati sugli arresti anomali (non collegati).

## Informazioni per la revisione (App Review Information)

- **Accesso richiesto**: sì. Account demo `memikaapp+review@gmail.com` (utente normale,
  cartella "Spagnolo" con ricordi; password nota ad Angelo, mai nel repo). **Non**
  usare mai l'account admin per i revisori.
- **Note**: "Memika è un'app di ripetizione spaziata. Accedi con l'account demo, apri
  Oggi e tocca Inizia il ripasso: le tre fasi Scan, Reinforcement e Focus. La
  cancellazione dell'account è in Impostazioni → Elimina account."
  Da vc13 / iOS 3 aggiungere: "Il piano Free tiene 10 ricordi in tutto e una
  cartella; Impostazioni → Piano apre il paywall con Pro e Premium. L'account
  demo è Premium, quindi non incontra i limiti." (Con le chiavi RevenueCat
  vuote i bottoni del paywall sono spenti e il binario NON ha acquisti in-app:
  in quel caso tenere la vecchia frase "Nessun acquisto in-app in questa
  versione" e non spuntare la casella IAP.)
- **Contatto**: Angelo Casula, acasula97@gmail.com, telefono da inserire.

## Testi scheda

Limiti Apple: nome 30, sottotitolo 30, testo promozionale 170 (modificabile senza
nuova build), descrizione 4000, parole chiave 100 (con le virgole, senza spazi
dopo la virgola, senza ripetere il nome), novità 4000.

Nota (aggiornata 2026-09-04, build 3): la vecchia riga "finché Premium non esiste
la descrizione dice solo «Memika è gratuita»" non vale più. Da vc13 / iOS 3 il
binario porta `app/paywall.tsx` con due abbonamenti a rinnovo automatico e un
piano Free tappato dai trigger Postgres a 10 ricordi in tutto, 1 cartella e 0
sezioni. Le quattro descrizioni dicono ora i tetti del piano Free e i due piani a
pagamento: una pagina prodotto che promette "Memika è gratuita" mentre Apple le
appiccica il badge "Acquisti in-app", e un utente fermato al decimo ricordo da un
limite che la scheda non nomina, sono 2.3.1 (metadati accurati) e 3.1.2
(informazioni sull'abbonamento). Se per qualsiasi motivo la build uscisse con le
chiavi RevenueCat vuote (bivio del punto 4 di `docs/DEPLOY.md` § "Prima di
lanciare"), i tetti Free restano veri e vanno comunque dichiarati: cambia solo
che i due piani non sono acquistabili, e in quel caso i due paragrafi sugli
abbonamenti vanno tolti prima di incollare.

### Italiano (it) — principale

**Sottotitolo** (29): Ripassa e non dimenticare più

**Testo promozionale** (166): Ripassa pochi minuti al giorno e non dimenticare quello che hai studiato. Niente streak, niente classifiche, niente pubblicità: solo un posto tranquillo dove tornare.

**Parole chiave** (98): ripasso,spaziato,flashcard,memoria,memorizzare,vocaboli,kanji,medicina,diritto,esame,studio,lingue

**Descrizione**:

Memika serve a non dimenticare quello che hai già studiato.

Salvi una parola, un termine o un concetto con la sua spiegazione e un esempio. Da quel momento ci pensa Memika a riproportelo al momento giusto, prima che ti sfugga.

Ogni ripasso passa da tre fasi, sempre nello stesso ordine.
Scan: un controllo veloce, lo ricordi oppure no.
Reinforcement: un indizio prima della risposta, per fissare quello che hai visto negli ultimi giorni.
Focus: il ripasso vero e proprio, in cui decidi tu se lo hai dimenticato o se lo ricordi bene.

Ogni giorno scegli quanto tempo hai, da cinque minuti a più di un'ora, e Memika prepara il piano di ripasso di conseguenza.

Nella schermata Oggi vedi cosa è in scadenza e quanto tempo serve. Nelle cartelle tieni i ricordi divisi per argomento, che sia una lingua, medicina, diritto o la materia di un esame. Nella salute della memoria vedi quali ricordi sono stabili e quali stanno sbiadendo.

Niente streak, niente classifiche, niente pubblicità. Solo un posto tranquillo dove tornare per qualche minuto al giorno.

Memika è gratuita: 10 ricordi in tutto e una cartella, per sempre e senza pubblicità.

Se ti serve più spazio ci sono due abbonamenti. Pro: ricordi illimitati, 5 cartelle, 3 sezioni per cartella. Premium: tutto illimitato, più le foto da allegare ai ricordi. Si rinnovano automaticamente e si disdicono quando vuoi dalle impostazioni del tuo account App Store.

I ricordi sono tuoi. Puoi cancellare tutto quando vuoi dalle Impostazioni e chiederci una copia dei tuoi dati in qualsiasi momento. Informativa sulla privacy: https://ioterra360.github.io/memika-legal/privacy/

**Novità (1.0)**: Prima versione di Memika. Salva quello che studi e ripassalo al momento giusto, in tre fasi: Scan, Reinforcement e Focus. Ogni giorno scegli quanto tempo hai e Memika prepara il piano di ripasso.

### English (en-US)

**Subtitle** (29): Don't forget what you studied

**Promotional text** (153): Review a few minutes a day and keep what you studied from fading away. No streaks, no leaderboards, no ads: just a quiet place to come back to every day.

**Keywords** (100): spaced repetition,flashcards,memory,vocabulary,kanji,medicine,law,study,exam,review,recall,srs,learn

**Description**:

Memika helps you keep what you have already studied.

Save a word, a term or a concept with its meaning and an example. From then on Memika brings it back at the right moment, before it slips away.

Every review goes through three phases, always in the same order.
Scan: a quick check, you remember it or you don't.
Reinforcement: a hint before the answer, to settle what you saw in the last few days.
Focus: the real review, where you decide whether you forgot it or remember it well.

Each day you choose how much time you have, from five minutes to more than an hour, and Memika builds the review plan around it.

The Today screen shows what is due and how long it takes. Folders keep your memories organised by topic, whether that is a language, medicine, law or an exam subject. Memory health shows which memories are stable and which are fading.

No streaks, no leaderboards, no ads. Just a quiet place to come back to for a few minutes a day.

Memika is free: 10 memories in total and one folder, forever, with no ads.

If you need more room there are two subscriptions. Pro: unlimited memories, 5 folders, 3 sections per folder. Premium: everything unlimited, plus photos attached to your memories. They renew automatically and you can cancel any time from your App Store account settings.

Your memories are yours. You can delete everything at any time from Settings and ask us for a copy of your data whenever you want. Privacy policy: https://ioterra360.github.io/memika-legal/privacy/

**What's new (1.0)**: First release of Memika. Save words, terms and concepts, then review them in three phases: Scan, Reinforcement and Focus. Choose how much time you have each day, keep your memories in folders and check their health. Available in Italian, English, French and Spanish.

### Français (fr-FR)

**Sous-titre** (29): Révise peu, retiens longtemps

**Texte promotionnel** (168): Révise quelques minutes par jour et n'oublie pas ce que tu as étudié. Pas de séries, pas de classements, pas de publicité : juste un endroit tranquille pour ta mémoire.

**Mots-clés** (98): répétition,espacée,flashcards,fiches,révision,mémoire,vocabulaire,kanji,médecine,droit,langues,bac

**Description**:

Memika t'aide à ne pas oublier ce que tu as déjà étudié.

Tu enregistres un mot, un terme ou un concept avec son explication et un exemple. À partir de là, Memika se charge de te le faire revoir au bon moment, avant qu'il ne t'échappe.

Chaque révision passe par trois phases, toujours dans le même ordre.
Scan : un contrôle rapide, tu t'en souviens ou non.
Reinforcement : un indice avant la réponse, pour fixer ce que tu as vu ces derniers jours.
Focus : la vraie révision, où c'est toi qui décides si tu l'as oublié ou si tu t'en souviens bien.

Chaque jour, tu choisis le temps que tu as, de cinq minutes à plus d'une heure, et Memika prépare le plan de révision en conséquence.

Sur l'écran Aujourd'hui, tu vois ce qui est à réviser et le temps qu'il faut. Dans les dossiers, tu gardes tes souvenirs classés par sujet, que ce soit une langue, la médecine, le droit ou la matière d'un examen. Dans la santé de la mémoire, tu vois quels souvenirs sont stables et lesquels sont en train de s'effacer.

Pas de séries à tenir, pas de classements, pas de publicité. Juste un endroit tranquille où revenir quelques minutes par jour.

Memika est gratuite : 10 souvenirs au total et un dossier, pour toujours, sans publicité.

S'il te faut plus de place, il y a deux abonnements. Pro : souvenirs illimités, 5 dossiers, 3 sections par dossier. Premium : tout en illimité, plus les photos à joindre aux souvenirs. Ils se renouvellent automatiquement et se résilient quand tu veux depuis les réglages de ton compte App Store.

Tes souvenirs t'appartiennent. Tu peux tout supprimer quand tu veux depuis les Réglages et nous demander une copie de tes données à tout moment. Politique de confidentialité : https://ioterra360.github.io/memika-legal/privacy/

**Nouveautés (1.0)**: Première version de Memika. Enregistre un mot, un terme ou un concept, révise-le en trois phases (Scan, Reinforcement, Focus) et suis la santé de ta mémoire, quelques minutes par jour.

### Español (es-ES)

**Subtítulo** (28): Para no olvidar lo estudiado

**Texto promocional** (113): Repasa unos minutos al día y no olvides lo que ya has estudiado. Sin rachas, sin clasificaciones, sin publicidad.

**Palabras clave** (98): repaso,espaciado,flashcards,tarjetas,memoria,vocabulario,kanji,medicina,derecho,examen,oposiciones

**Descripción**:

Memika sirve para no olvidar lo que ya has estudiado.

Guardas una palabra, un término o un concepto con su significado y un ejemplo. Desde ese momento, Memika se encarga de volver a mostrártelo en el momento justo, antes de que se te escape.

Cada repaso pasa por tres fases, siempre en el mismo orden.
Scan: una comprobación rápida, lo recuerdas o no.
Reinforcement: una pista antes de la respuesta, para asentar lo que has visto en los últimos días.
Focus: el repaso de verdad, en el que decides tú si lo has olvidado o si lo recuerdas bien.

Cada día eliges cuánto tiempo tienes, desde cinco minutos hasta más de una hora, y Memika ajusta el plan de repaso a ese tiempo.

En la pantalla Hoy ves qué toca repasar y cuánto tiempo hace falta. En las carpetas tienes tus recuerdos separados por tema, ya sea un idioma, medicina, derecho o la asignatura de un examen. En la salud de la memoria ves qué recuerdos están estables y cuáles se están desvaneciendo.

Sin rachas, sin clasificaciones, sin publicidad. Solo un lugar tranquilo al que volver unos minutos al día.

Memika es gratuita: 10 recuerdos en total y una carpeta, para siempre y sin publicidad.

Si necesitas más sitio hay dos suscripciones. Pro: recuerdos ilimitados, 5 carpetas, 3 secciones por carpeta. Premium: todo ilimitado, además de las fotos para adjuntar a los recuerdos. Se renuevan automáticamente y puedes cancelarlas cuando quieras desde los ajustes de tu cuenta de App Store.

Tus recuerdos son tuyos. Puedes borrarlo todo cuando quieras desde Ajustes y pedirnos una copia de tus datos en cualquier momento. Política de privacidad: https://ioterra360.github.io/memika-legal/privacy/

**Novedades (1.0)**: Primera versión de Memika. Guarda lo que estudias, elige cuánto tiempo tienes cada día y repasa en tres fases: Scan, Reinforcement y Focus.

## Prima del primo build iOS (nel codice, un solo giro di build)

Tutte queste modifiche cambiano il fingerprint iOS/Android: si fanno insieme e si
costruiscono entrambe le piattaforme dallo stesso commit.

1. Lingua di sistema su iOS letta con `Settings.get("AppleLocale")` (con la nuova
   architettura `NativeModules.SettingsManager.settings` è undefined: ogni iPhone
   riceverebbe l'inglese).
2. `CFBundleLocalizations` it/en/fr/es + `CFBundleDevelopmentRegion` it, così la
   scheda mostra le quattro lingue.
3. `NSAppTransportSecurity`: `NSAllowsArbitraryLoads` false, eccezione solo `localhost`.
4. Sezioni "Orari" e "Notifiche" delle Impostazioni nascoste dietro
   `NOTIFICATIONS_ENABLED = false` finché non fanno nulla (Linee guida 2.1);
   dalla build 3 il flag è `true` e la riga apre `/notifications`: le sezioni
   inline non esistono più.
5. Nome visualizzato facoltativo alla registrazione (5.1.1, minimizzazione).
6. Vecchia schermata checkout web (`subscribe.tsx`) rimossa dal binario con le sue
   chiavi di catalogo; dalla build 3 il paywall in-app e' `app/paywall.tsx` (RevenueCat).
7. Se il DSN di Sentry arriva in tempo: slug reali in app.json, DSN in `eas.json`,
   `SENTRY_AUTH_TOKEN` come segreto EAS, via `SENTRY_DISABLE_AUTO_UPLOAD`.

Pre-check prima di `eas build`: `npm prune --legacy-peer-deps`, `npx expo-doctor`,
`npx expo config --type introspect --json`, Hermes pre-check sia `android` sia
`ios`, `npx expo-updates fingerprint:generate --platform ios` e `--platform android`
annotati. Dopo il build gli OTA si pubblicano con `--platform all`.

## TestFlight: cosa provare su iPhone (mai girato su iOS finora)

- Avvio a freddo mantiene la sessione; lingua italiana su un iPhone italiano.
- La tastiera non copre mai il pulsante principale in Login, Registrazione, Password
  dimenticata, Reimposta password e Aggiungi.
- Aggiungi e scheda ricordo si aprono come fogli e si chiudono con lo swipe senza
  rompere la navigazione (`lib/add-gate.ts`).
- Link di reimpostazione password da Mail apre l'app (`memika://reset-password`).
- Ripasso completo Scan → Reinforcement → Focus, feedback aptico, recap.
- Elimina account dalle Impostazioni.

## Dopo la pubblicazione (igiene)

- Togliere `exp://**` e `exp+memika://**` dalla allow-list Supabase Auth
  (`docs/DEPLOY.md`) e ritestare il reset password da una build store.
- Attivare Sentry (org EU) e togliere `SENTRY_DISABLE_AUTO_UPLOAD`.
