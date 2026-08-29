# Scheda Google Play — Memika

> Testi e risposte pronti per compilare Play Console (2026-08-26). Stessi testi riutilizzabili per App Store Connect.
> Asset: `docs/store-assets/play-icon-512.png`, `docs/store-assets/feature-graphic-1024x500.png`, `docs/store-assets/appstore-icon-1024.png`, screenshot in `docs/store-assets/screenshots/phone/`.

## Scheda principale (Crescita → Presenza sullo store → Scheda principale)

**Nome app** (≤30): `Memika`
(alternativa ASO: `Memika: ripasso spaziato`)

**Descrizione breve** (≤80, 73 caratteri):
`Ripassa pochi minuti al giorno e non dimenticare quello che hai studiato.`

**Descrizione completa** (≤4000, versione 2026-08-27 riscritta in tono naturale, senza trattini lunghi):

```
Memika serve a non dimenticare quello che hai già studiato.

Salvi una parola, un termine o un concetto con la sua spiegazione e un esempio. Da quel momento ci pensa Memika a riproportelo al momento giusto, prima che ti sfugga.

Ogni ripasso passa da tre fasi, sempre nello stesso ordine.
Scan: un controllo veloce, lo ricordi oppure no.
Reinforcement: un indizio prima della risposta, per fissare quello che hai visto negli ultimi giorni.
Focus: il ripasso vero e proprio, in cui decidi tu se lo hai dimenticato o se lo ricordi bene.

Ogni giorno scegli quanto tempo hai, da cinque minuti a più di un'ora, e Memika prepara il piano di ripasso di conseguenza.

Nella schermata Oggi vedi cosa è in scadenza e quanto tempo serve. Nelle cartelle tieni i ricordi divisi per argomento, che sia una lingua, medicina, diritto o la materia di un esame. Nella salute della memoria vedi quali ricordi sono stabili e quali stanno sbiadendo.

Niente streak, niente classifiche, niente pubblicità. Solo un posto tranquillo dove tornare per qualche minuto al giorno.

Memika è gratuita con una cartella di ricordi. Le cartelle illimitate arriveranno con Memika Premium, in abbonamento tramite Google Play.

I ricordi sono tuoi. Puoi cancellare tutto quando vuoi dalle Impostazioni e chiederci una copia dei tuoi dati in qualsiasi momento. Informativa sulla privacy: https://ioterra360.github.io/memika-legal/privacy/
```

> Nota 2026-08-27: nelle build di test il limite di una cartella è disattivato (`FOLDER_LIMIT_ENFORCED=false`): i tester possono creare fino a 5 cartelle (4 modelli + 1 personalizzata). La frase "gratuita con una cartella" descrive il prodotto finale; riattivare il flag prima della produzione o adeguare il testo.

**Categoria**: App → Istruzione
**Tag** (max 5, se disponibili): Apprendimento, Flashcard, Lingue, Studio
**Email di contatto**: memikaapp@gmail.com
**Sito web**: https://ioterra360.github.io/memika-legal/
**Norme sulla privacy**: https://ioterra360.github.io/memika-legal/privacy/

**Grafica**
- Icona 512×512: `docs/store-assets/play-icon-512.png`
- Grafica in evidenza 1024×500: `docs/store-assets/feature-graphic-1024x500.png`
- Screenshot telefono (8, PNG 1080×1920, 9:16, senza alpha — vincoli Play verificati): `docs/store-assets/screenshots/phone/01-oggi.png … 08-aggiungi.png`. Generati il 2026-08-27 dall'app vera in demo mode (Expo web + Playwright) e impaginati con titolo: Oggi (apertura navy) · Scan · Reinforcement · Focus · Cartelle · Cartella Spagnolo · Salute della memoria · Aggiungi. Pipeline e testi in `scripts/store-screenshots/` (README con la ricetta e il gotcha fingerprint). Caricarli nell'ordine dei numeri.
- Tablet 7"/10": non richiesti (`supportsTablet: false`, nessun layout tablet).

## Scheda in inglese (en-US) — aggiungere come traduzione della scheda

**App name** (≤30): `Memika`

**Short description** (≤80, 66 caratteri):
`Review a few minutes a day and keep what you studied from fading away.`

**Full description** (≤4000):

```
Memika helps you keep what you have already studied.

Save a word, a term or a concept with its meaning and an example. From then on Memika brings it back at the right moment, before it slips away.

Every review goes through three phases, always in the same order.
Scan: a quick check, you remember it or you don't.
Reinforcement: a hint before the answer, to settle what you saw in the last few days.
Focus: the real review, where you decide whether you forgot it or remember it well.

Each day you choose how much time you have, from five minutes to more than an hour, and Memika builds the review plan around it.

The Today screen shows what is due and how long it takes. Folders keep your memories organised by topic, whether that is a language, medicine, law or an exam subject. Memory health shows which memories are stable and which are fading.

No streaks, no leaderboards, no ads. Just a quiet place to come back to for a few minutes a day.

Memika is free with one folder of memories. Unlimited folders will come with Memika Premium, as a subscription through Google Play.

Your memories are yours. You can delete everything at any time from Settings and ask us for a copy of your data whenever you want. Privacy policy: https://ioterra360.github.io/memika-legal/privacy/
```

Screenshot in inglese: `scripts/store-screenshots/specs.en.json` (stessi 8 file raw catturati con l'app in inglese: `capture.cjs --locale en`, poi `compose.py specs.en.json docs/store-assets/screenshots/phone-en`).

## Scheda in francese (fr-FR)

**Short description** (≤80, 69 caratteri):
`Révise quelques minutes par jour et n'oublie pas ce que tu as étudié.`

**Full description** (1521/4000):

```
Memika t'aide à ne pas oublier ce que tu as déjà étudié.

Tu enregistres un mot, un terme ou un concept avec son explication et un exemple. À partir de là, Memika se charge de te le faire revoir au bon moment, avant qu'il ne t'échappe.

Chaque révision passe par trois phases, toujours dans le même ordre.
Scan : un contrôle rapide, tu t'en souviens ou non.
Reinforcement : un indice avant la réponse, pour fixer ce que tu as vu ces derniers jours.
Focus : la vraie révision, où c'est toi qui décides si tu l'as oublié ou si tu t'en souviens bien.

Chaque jour, tu choisis le temps que tu as, de cinq minutes à plus d'une heure, et Memika prépare le plan de révision en conséquence.

Sur l'écran Aujourd'hui, tu vois ce qui est à réviser et le temps qu'il faut. Dans les dossiers, tu gardes tes souvenirs classés par sujet, que ce soit une langue, la médecine, le droit ou la matière d'un examen. Dans la santé de la mémoire, tu vois quels souvenirs sont stables et lesquels sont en train de s'effacer.

Pas de séries à tenir, pas de classements, pas de publicité. Juste un endroit tranquille où revenir quelques minutes par jour.

Memika est gratuite avec un dossier de souvenirs. Les dossiers illimités arriveront avec Memika Premium, sur abonnement via Google Play.

Tes souvenirs t'appartiennent. Tu peux tout supprimer quand tu veux depuis les Paramètres et nous demander une copie de tes données à tout moment. Politique de confidentialité : https://ioterra360.github.io/memika-legal/privacy/
```

Screenshot: `scripts/store-screenshots/specs.fr.json` → `docs/store-assets/screenshots/phone-fr/`.

## Scheda in spagnolo (es-ES)

**Short description** (≤80, 64 caratteri):
`Repasa unos minutos al día y no olvides lo que ya has estudiado.`

**Full description** (1436/4000):

```
Memika sirve para no olvidar lo que ya has estudiado.

Guardas una palabra, un término o un concepto con su significado y un ejemplo. Desde ese momento, Memika se encarga de volver a mostrártelo en el momento justo, antes de que se te escape.

Cada repaso pasa por tres fases, siempre en el mismo orden.
Scan: una comprobación rápida, lo recuerdas o no.
Reinforcement: una pista antes de la respuesta, para asentar lo que has visto en los últimos días.
Focus: el repaso de verdad, en el que decides tú si lo has olvidado o si lo recuerdas bien.

Cada día eliges cuánto tiempo tienes, desde cinco minutos hasta más de una hora, y Memika ajusta el plan de repaso a ese tiempo.

En la pantalla Hoy ves qué toca repasar y cuánto tiempo hace falta. En las carpetas tienes tus recuerdos separados por tema, ya sea un idioma, medicina, derecho o la asignatura de un examen. En la salud de la memoria ves qué recuerdos están estables y cuáles se están desvaneciendo.

Sin rachas, sin clasificaciones, sin publicidad. Solo un lugar tranquilo al que volver unos minutos al día.

Memika es gratuita con una carpeta de recuerdos. Las carpetas ilimitadas llegarán con Memika Premium, por suscripción a través de Google Play.

Tus recuerdos son tuyos. Puedes borrarlo todo cuando quieras desde Ajustes y pedirnos una copia de tus datos en cualquier momento. Política de privacidad: https://ioterra360.github.io/memika-legal/privacy/
```

Screenshot: `scripts/store-screenshots/specs.es.json` → `docs/store-assets/screenshots/phone-es/`.

## Contenuti dell'app (Monitoraggio norme → Contenuti dell'app)

**Norme sulla privacy** → https://ioterra360.github.io/memika-legal/privacy/

**Accesso all'app** → *Tutte o alcune funzionalità sono limitate* → Aggiungi istruzioni:
- Nome: `Account di prova reviewer`
- Email: `memikaapp+review@gmail.com`
- Password: quella impostata il 2026-08-26 (non nel repo; conservata da Angelo)
- Istruzioni: "Accedi con email e password. L'account ha già una cartella 'Spagnolo' con 6 ricordi in scadenza: da 'Oggi' tocca 'Inizia il ripasso' per vedere Scan → Reinforcement → Focus. 'Aggiungi' (+) salva un nuovo ricordo. Impostazioni → Elimina account mostra la cancellazione (non eseguirla sull'account di prova)."

**Annunci** → No, l'app non contiene annunci.

**ID pubblicità (Advertising ID)** → No: nessun SDK pubblicitario/analytics, nessuna permission `com.google.android.gms.permission.AD_ID` nel manifest (verificato in expo, expo-updates, @sentry/react-native). Se la Console segnala un'incoerenza col manifest caricato, ricontrollare l'AAB.

**Classificazione dei contenuti** (questionario IARC) → categoria *Riferimento, notizie o istruzione* (in alternativa *Utilità, produttività, comunicazione o altro*). Risposte: nessuna violenza, nessun contenuto sessuale, nessun linguaggio volgare, nessuna sostanza, nessun gioco d'azzardo, nessuna interazione tra utenti né condivisione di contenuti, nessuna condivisione di posizione, nessun acquisto di beni digitali (finché non ci sono gli IAP: aggiornare a "sì" con RevenueCat), nessun accesso illimitato a internet (i link legali si aprono nel browser di sistema). Risultato atteso: PEGI 3 / Everyone.

**Pubblico target e contenuti** → fasce *16-17* e *18 anni e oltre* (i Termini e la Privacy pubblicati riservano l'app ai maggiori di 16 anni — dichiarare solo 18+ sarebbe incoerente con le pagine legali); l'app non è pensata per bambini; la mascotte è un cervello cartoon ma il contenuto (lingue, medicina, diritto, esami) non attira i minori di 13 anni. Decisione da confermare con Maurizio (2026-08-27).

**App di notizie** → No. **App per il tracciamento dei contatti COVID-19** → No. **App governativa** → No. **Funzionalità finanziarie** → Nessuna. **App per la salute** → Nessuna funzionalità sanitaria.

**Sicurezza dei dati** (Data safety)
- Raccolta/condivisione: l'app raccoglie dati; **non condivide** dati con terze parti (Supabase e Sentry sono fornitori di servizi che trattano per conto nostro, non "condivisione" secondo la definizione di Google).
- I dati sono crittografati in transito: **Sì**.
- L'utente può richiedere l'eliminazione: **Sì** (in-app: Impostazioni → Elimina account; web: https://ioterra360.github.io/memika-legal/account-deletion/).
- Tipi di dati raccolti:
  | Categoria | Tipo | Raccolto | Condiviso | Obbligatorio | Finalità |
  |---|---|---|---|---|---|
  | Informazioni personali | Indirizzo email | Sì | No | Sì | Gestione account |
  | Informazioni personali | Nome | Sì | No | Sì (richiesto alla registrazione) | Funzionalità dell'app, Personalizzazione |
  | Attività nell'app | Altri contenuti generati dagli utenti (i ricordi) | Sì | No | Sì | Funzionalità dell'app |
  | Attività nell'app | Azioni nell'app (esiti dei ripassi) | Sì | No | Sì | Funzionalità dell'app |
  | Info e prestazioni app | Log degli arresti anomali | Sì* | No | No | Analisi |
  | Info e prestazioni app | Diagnostica | Sì* | No | No | Analisi |
  | Dispositivo o altri ID | Dispositivo o altri ID | Sì* | No | No | Analisi |
  \* Solo se Sentry è attivo nella build pubblicata (DSN impostato). **Le build attuali (vc7–vc11) NON hanno il DSN in `eas.json` → dichiarare "No" per log arresti anomali e diagnostica** e aggiornare il modulo quando si attiva.
  Nota: da vc9 in poi `expo-updates` invia un ID client EAS per installazione al server di aggiornamento di Expo (verifica aggiornamenti OTA): se la Console lo richiede, dichiararlo come "Dispositivo o altri ID · Raccolto · Non condiviso · Funzionalità dell'app" (fornitore di servizi, non condivisione).
- Nessun dato trattato in modo effimero; nessuna raccolta di posizione, contatti, foto, file, messaggi.

## Impostazioni store (Crescita → Presenza sullo store → Impostazioni)
- Tipo app: App · Categoria: Istruzione
- Dettagli di contatto: email memikaapp@gmail.com · sito https://ioterra360.github.io/memika-legal/
- Distribuzione: tutti i paesi (o solo Italia per il primo periodo) · l'app è gratuita (non modificabile dopo) · contiene acquisti in-app: sì (spuntare quando RevenueCat è attivo)

## Test chiuso (obbligatorio per account Personal prima della produzione)
1. Test → Test chiuso → crea il track "Beta" → carica lo stesso AAB → lista tester con ≥12 email Gmail → salva → invia per revisione (serve la scheda completa sopra).
2. Invia ai tester il link di opt-in; devono accettare **e restare iscritti 14 giorni di fila** (l'app installata; non serve usarla).
3. Dopo 14 giorni: Dashboard → "Richiedi l'accesso alla produzione" → questionario (cosa avete testato, cosa è cambiato) → risposta di Google entro ~7 giorni.

## Da fare quando ci sono gli IAP (RevenueCat)
- Classificazione contenuti: "acquisti di beni digitali" → sì
- Impostazioni store: "contiene acquisti in-app" → sì
- Prodotti → Abbonamenti: creare il prodotto Premium (prezzo, periodo, prova gratuita)
- Profilo pagamenti merchant sotto l'owner (memikaapp@gmail.com) — solo DOPO la finalizzazione del trasferimento
