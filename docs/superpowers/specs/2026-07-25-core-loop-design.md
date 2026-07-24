# Spec — Ciclo "Core loop vero"

> Approvata da Angelo il 2026-07-25 dopo brainstorming. Lingua: italiano
> (artefatto di collaborazione; i docs core del repo restano in inglese).
> Architettura scelta: **Approccio A — fetch diretto via `lib/api.ts`**
> (nessun nuovo store centrale, nessuna logica server-side).

## 1. Obiettivo

A fine ciclo l'app smette di essere una demo: aggiungi un ricordo vero → lo
ritrovi in ripasso al momento giusto → la risposta aggiorna lo schedule
(SM-2 esistente in `features/srs/scheduler.ts`) → recap e Progressi mostrano
numeri veri. La modalità demo (`EXPO_PUBLIC_DEMO_MODE`) resta funzionante e
identica a oggi, isolata dentro `api.ts`.

## 2. Dati e API (`lib/api.ts`)

Nuove funzioni (tutte con branch demo esplicito):

- **`createMemory(input)`** — scrive su `public.memories`: `user_id`,
  `folder_id`, `term`, `reading?`, `definition`, `example?`, `type`.
  SRS iniziale da `initialSrsState()`, `next_review_at = now()` (il nuovo
  ricordo entra subito in coda — il toast "primo ripasso domani" è framing
  UX, come da SRS.md). Demo: no-op che risolve subito.
- **`fetchDueMemoriesByLayer(userId, layer, { folderKind?, cap })`** —
  ricordi con `next_review_at <= now()`, esclusi quelli di cartelle in pausa,
  ordinati per `next_review_at` asc, limitati a `cap`. Slicing per livello
  (da SRS.md):
  - `scan`: `srs_repetitions < 3`
  - `reinforcement`: `3 ≤ srs_repetitions < 8` **oppure** `state = 'fading'`
  - `focus`: `srs_repetitions ≥ 8`
  Il filtro cartella risolve `kind → folder_id` (preferire `folder_id`).
  Demo: restituisce i mazzi statici attuali.
- **`fetchDueCounts(userId)`** — conteggi per livello per le card di Oggi
  (query leggera, richiamata al focus della schermata).
- **`fetchTodayInputCount(userId)`** — inserimenti di oggi per il limite
  giornaliero. Confine di giornata calcolato client-side (giorno locale,
  inviato come range ISO).

Lo slicing e l'applicazione del budget vivono in un **modulo puro
testabile** (`lib/queue.ts`): `sliceByLayer(memories)` e
`applyBudget(slices, capTotale)`.

## 3. Aggiungi ricordo (Add)

- La textarea unica diventa **campi separati**: Termine + Definizione
  (obbligatori), Lettura (solo cartella `jp`, opzionale), Esempio
  (opzionale). I chip tipo restano.
- Salva → `createMemory` → toast → il contatore giornaliero usa
  `fetchTodayInputCount` + `dailyInputCap` del profilo (non più lo stato
  locale finto).
- Superamento del limite = **avviso morbido, non blocco** (da SRS.md).
- L'anteprima card mostra i campi reali che l'utente sta scrivendo
  (via la preview finta `ADD_PREVIEW_BY_KIND`).
- "Salva e aggiungi un altro" resta (svuota i campi, mantiene cartella/tipo).

## 4. Mazzi veri + budget tempo

- `review-store.start()` / `ensureSession()` caricano il mazzo via
  `fetchDueMemoriesByLayer` (async): stato `deckLoading` nello store, gli
  screen mostrano il `MascotLoader` (sez. 12) finché il mazzo non c'è.
  Lo stato vuoto calmo esiste già e resta.
- Budget tempo (chips di Oggi): tetto items totale **9 / 27 / 54 / 108**
  (5/15/30/60 min), ripartito sui tre livelli in proporzione alla coda di
  ciascuno (resto allo Scan). Il chip selezionato vive nello stato di Oggi e
  viene passato a `start()`.
- **Il piano di Oggi è reattivo al budget**: cambiando chip, le tre card
  del flusso ricalcolano subito quantità per livello e minuti stimati, e la
  riga "Totale · N ricordi · ~M min" segue. Ogni budget propone un piano di
  lavoro giornaliero visibilmente diverso, e la sessione fluida esegue
  esattamente il piano mostrato — mai più numeri fissi.
- Il budget scelto viene ricordato (AsyncStorage) così la proposta del
  giorno sopravvive a riaperture dell'app.
- Le card di Oggi mostrano i conteggi veri (`fetchDueCounts` al focus).
- "Ripassa ora" nella cartella = Scan singolo filtrato per cartella, carte
  vere, stesso cap del budget di default (15 min).

## 5. Flusso fluido

- **CTA "Inizia il ripasso di oggi" = fluido**: fine Scan → transizione
  automatica breve (~1 s: nome + colore del livello, nessun tap) →
  Reinforcement → Focus → **un solo recap finale**. La schermata handoff
  attuale diventa questo interstitial auto-avanzante; sparisce come stop
  manuale. `advanceToLayer()` continua a essere chiamato (una riga
  `review_sessions` per livello, come oggi).
- **Card singola su Oggi / "Ripassa ora" cartella = separato**: un livello
  solo, recap di livello alla fine.
- **Nessun nuovo toggle**: i due punti d'ingresso sono le due modalità.
  (Eventuale preferenza persistente: ciclo futuro.)

## 6. Scan — flash di conferma

- Tap "Lo ricordo" → risposta registrata come `remembered`, la soluzione
  appare per ~1,2 s (card colorata) mentre si avanza alla carta successiva.
- Un tocco sul flash entro la finestra **corregge** la risposta in
  `struggled` (declassamento onesto).
- Implementazione della correzione: la persistenza delle risposte Scan è
  **differita di ~1,2 s** (la durata del flash), così l'amend avviene prima
  della scrittura — niente doppie scritture da riconciliare. Lo store
  espone `amendLastAnswer()` che ricalcola contatori e SRS dal snapshot
  precedente (conservato per l'ultima carta).
- "Mostrami" resta identico (reveal → "Lo ricordo" logga `struggled`).

## 7. Recap di sessione con la mascotte

- La schermata Complete viene rifatta:
  - **Mascotte animata** (Reanimated v4: entrata + micro-animazione idle).
  - Messaggio di incoraggiamento variabile per fascia di risultato
    (es. ≥80% ricordati / 50–79% / <50%).
  - **Grafico** dei risultati (ricordati / difficili / dimenticati) coerente
    col design system editoriale.
  - **Lista carta per carta** con esito colorato (verde/ambra/rosso) e
    indicazione se hai usato "Mostrami".
  - Fluido: aggregato totale + breakdown per livello. Separato: solo il
    livello svolto.
- Prerequisito: il review-store traccia l'esito **per carta**
  (`{ id, term, layer, response, revealed }`) per la sessione corrente —
  oggi questi dati si perdono.

## 8. Progressi con dati veri

- Le righe per cartella usano `fetchFoldersWithStats` (già esistente)
  invece dei numeri hardcoded.
- Carico cognitivo: euristica semplice `pct = min(100, dueTotali/120·100)`
  (120 = tetto del budget 1 h). Dichiaratamente da tarare più avanti.
- Card "Riequilibra": calcolo semplice e onesto — la cartella col maggior
  numero di ricordi `fading` (nascosta se nessuna ne ha), testo dinamico,
  link a quella cartella.

## 9. Impostazioni cartella complete

- **Statistiche** in cima: totale ricordi, distribuzione
  stabili/dissolvenza/archiviati (riuso RetentionBar/StatBlock), aggiunti
  questa settimana, ultimo ripasso. Tutto dai dati esistenti.
- **Rinomina**: già funzionante, resta.
- **Cartella dormiente**: toggle "Metti in pausa" → nuova colonna
  `paused boolean not null default false` su `public.folders`
  (**migrazione nuova**, mai editare le esistenti; aggiornare
  DATA-MODEL.md). Cartella in pausa: esclusa da `fetchDueMemoriesByLayer`
  e dai conteggi di Oggi; in Cartelle appare attenuata con etichetta
  "In pausa"; "Ripassa ora" disabilitato con spiegazione.
- **Elimina cartella**: zona pericolosa in fondo, conferma modale (pattern
  del delete account) col numero di ricordi che verranno eliminati (il DB
  cascada già). ⚠️ Nota prodotto da riferire a Maurizio: le 4 seed sono
  decisione bloccata; con l'eliminazione un utente può restare sotto 4 e
  non si riseedano.
- L'ordine resta col drag in Cartelle (nota in pagina invariata).

## 10. Caricamenti con la mascotte

- Componente unico **`MascotLoader`** (mascotte con rotazione
  dolce/oscillazione via Reanimated) al posto di ogni `ActivityIndicator` e
  stato di attesa spoglio: apertura cartella, caricamento mazzo, lista
  Cartelle, Progressi, salvataggio in Add, recap.

## 11. Fuori scope (esplicito)

Cartelle custom, notifiche/badge (Calm Mode resta preferenza salvata),
RevenueCat/IAP, estrazione AI, FSRS, preferenza persistente
fluido/separato, time picker per gli orari, **lato admin con dati veri**
(oggi è demo con KPI hardcoded — candidato naturale per il ciclo
successivo, insieme alla roadmap Fase 4).

## 12. Verifica — "done when"

- [ ] Aggiungi salva su Supabase; contatore giornaliero reale; avviso
      morbido oltre il limite
- [ ] Un ricordo appena aggiunto compare nello Scan della sessione
      successiva
- [ ] Flusso fluido: nessun tap tra i livelli, un solo recap finale
- [ ] Sessione singola: recap del livello
- [ ] Flash di conferma su Scan, con correzione al tocco
- [ ] Il budget tempo cambia la dimensione del mazzo (9/27/54/108, split
      proporzionale)
- [ ] Il piano di Oggi si ricalcola live al cambio di chip (quantità +
      minuti per card) e la sessione esegue esattamente il piano mostrato;
      il budget scelto sopravvive al riavvio
- [ ] Impostazioni cartella: statistiche, pausa (esclude dalla coda),
      elimina con conferma e conteggio
- [ ] Progressi senza numeri hardcoded
- [ ] `MascotLoader` in ogni stato di caricamento
- [ ] Unit test verdi sul modulo `lib/queue.ts` (confini livelli, budget,
      filtro cartella, esclusione pausa)
- [ ] `npm run lint` pulito; E2E manuale su device (aggiungi → ripassa →
      verifica schedule il giorno dopo)
- [ ] Modalità demo invariata su tutte le superfici
