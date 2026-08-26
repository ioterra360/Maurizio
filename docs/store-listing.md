# Scheda Google Play — Memika

> Testi e risposte pronti per compilare Play Console (2026-08-26). Stessi testi riutilizzabili per App Store Connect.
> Asset: `docs/store-assets/play-icon-512.png`, `docs/store-assets/feature-graphic-1024x500.png`, `docs/store-assets/appstore-icon-1024.png`.

## Scheda principale (Crescita → Presenza sullo store → Scheda principale)

**Nome app** (≤30): `Memika`
(alternativa ASO: `Memika: ripasso spaziato`)

**Descrizione breve** (≤80):
`Ripasso spaziato, calmo: tieni vivo ciò che hai già imparato.`

**Descrizione completa** (≤4000):

```
Memika ti aiuta a non dimenticare quello che hai già imparato.

Non è un corso e non è un gioco: è un ripasso spaziato calmo, pensato per chi costruisce conoscenza nel tempo — lingue, medicina, diritto, esami professionali — e sa che le cose si dimenticano se non le rivedi al momento giusto.

COME FUNZIONA
Salvi un ricordo (una parola, un termine, un concetto) con la sua spiegazione e un esempio. Memika calcola quando riproportelo e lo fa passare per tre ritmi di ripasso, sempre nello stesso ordine:
• Scan — un controllo rapido: lo ricordi o no.
• Reinforcement — richiamo guidato, con un indizio prima della risposta.
• Focus — ripasso profondo: dimenticato, faticoso o ricordato.

Ogni giorno scegli quanto tempo hai — 5, 15, 30 minuti — e Memika prepara il piano di ripasso adatto.

COSA VEDI
• Oggi: cosa è in scadenza e quanto tempo serve.
• Cartelle: i tuoi ricordi organizzati per argomento.
• Salute della memoria: quali ricordi sono stabili e quali stanno sbiadendo.

SENZA RUMORE
Niente streak, niente classifiche, niente pubblicità. Un posto tranquillo dove tornare pochi minuti al giorno.

GRATIS E PREMIUM
Memika è gratuita con una cartella di ricordi. In arrivo Memika Premium, con cartelle illimitate, gestito come abbonamento dal Google Play Store.

I TUOI DATI
I ricordi sono tuoi: puoi esportare ed eliminare tutto in qualsiasi momento dalle Impostazioni. Informativa sulla privacy: https://ioterra360.github.io/memika-legal/privacy/
```

**Categoria**: App → Istruzione
**Tag** (max 5, se disponibili): Apprendimento, Flashcard, Lingue, Studio
**Email di contatto**: memikaapp@gmail.com
**Sito web**: https://ioterra360.github.io/memika-legal/
**Norme sulla privacy**: https://ioterra360.github.io/memika-legal/privacy/

**Grafica**
- Icona 512×512: `docs/store-assets/play-icon-512.png`
- Grafica in evidenza 1024×500: `docs/store-assets/feature-graphic-1024x500.png`
- Screenshot telefono: minimo 2, massimo 8, PNG/JPEG, 9:16, lato tra 320 e 3840 px. Da fare dal telefono di Maurizio con la build interna installata: Oggi · Scegli il tuo argomento · Scan · Cartelle · Salute della memoria · Impostazioni.
- Tablet 7"/10": non richiesti (`supportsTablet: false`, nessun layout tablet).

## Contenuti dell'app (Monitoraggio norme → Contenuti dell'app)

**Norme sulla privacy** → https://ioterra360.github.io/memika-legal/privacy/

**Accesso all'app** → *Tutte o alcune funzionalità sono limitate* → Aggiungi istruzioni:
- Nome: `Account di prova reviewer`
- Email: `memikaapp+review@gmail.com`
- Password: quella impostata il 2026-08-26 (non nel repo; conservata da Angelo)
- Istruzioni: "Accedi con email e password. L'account ha già una cartella 'Spagnolo' con 6 ricordi in scadenza: da 'Oggi' tocca 'Inizia il ripasso' per vedere Scan → Reinforcement → Focus. 'Aggiungi' (+) salva un nuovo ricordo. Impostazioni → Elimina account mostra la cancellazione (non eseguirla sull'account di prova)."

**Annunci** → No, l'app non contiene annunci.

**Classificazione dei contenuti** (questionario IARC) → categoria *Riferimento, notizie o istruzione* (in alternativa *Utilità, produttività, comunicazione o altro*). Risposte: nessuna violenza, nessun contenuto sessuale, nessun linguaggio volgare, nessuna sostanza, nessun gioco d'azzardo, nessuna interazione tra utenti né condivisione di contenuti, nessuna condivisione di posizione, nessun acquisto di beni digitali (finché non ci sono gli IAP: aggiornare a "sì" con RevenueCat), nessun accesso illimitato a internet (i link legali si aprono nel browser di sistema). Risultato atteso: PEGI 3 / Everyone.

**Pubblico target e contenuti** → fascia *18 anni e oltre*; l'app non è pensata per bambini; nessun elemento che attiri involontariamente i minori.

**App di notizie** → No. **App per il tracciamento dei contatti COVID-19** → No. **App governativa** → No. **Funzionalità finanziarie** → Nessuna. **App per la salute** → Nessuna funzionalità sanitaria.

**Sicurezza dei dati** (Data safety)
- Raccolta/condivisione: l'app raccoglie dati; **non condivide** dati con terze parti (Supabase e Sentry sono fornitori di servizi che trattano per conto nostro, non "condivisione" secondo la definizione di Google).
- I dati sono crittografati in transito: **Sì**.
- L'utente può richiedere l'eliminazione: **Sì** (in-app: Impostazioni → Elimina account; web: https://ioterra360.github.io/memika-legal/account-deletion/).
- Tipi di dati raccolti:
  | Categoria | Tipo | Raccolto | Condiviso | Obbligatorio | Finalità |
  |---|---|---|---|---|---|
  | Informazioni personali | Indirizzo email | Sì | No | Sì | Gestione account |
  | Informazioni personali | Nome | Sì | No | No | Funzionalità dell'app, Personalizzazione |
  | Attività nell'app | Altri contenuti generati dagli utenti (i ricordi) | Sì | No | Sì | Funzionalità dell'app |
  | Attività nell'app | Azioni nell'app (esiti dei ripassi) | Sì | No | Sì | Funzionalità dell'app |
  | Info e prestazioni app | Log degli arresti anomali | Sì* | No | No | Analisi |
  | Info e prestazioni app | Diagnostica | Sì* | No | No | Analisi |
  | Dispositivo o altri ID | Dispositivo o altri ID | Sì* | No | No | Analisi |
  \* Solo se Sentry è attivo nella build pubblicata (DSN impostato). Se si pubblica senza Sentry, dichiarare "No" per queste tre righe e aggiornare il modulo quando si attiva.
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
