# SRS — the review engine

> The algorithm that decides when each memory is due for review.

## Status

✅ **Scala a fasi di Maurizio, attiva dal 2026-09-02** (migration
`20260902100000_review_phases.sql`, motore in `features/srs/phases.ts`).
Ha sostituito l'SM-2 adattato che era in `features/srs/scheduler.ts` (rimosso).

Fonti del modello: `materiale_maurizio/feedback_2026-08-28/` (screenshot
00–05, che prevalgono) e `Memora Timing System UPDATED.pdf` §6/§15. La spec
di prodotto è `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md`
§F2.

## Il modello in una frase

Ogni ricordo sta in una **fase** di una scala fissa; ogni fase dice quando il
ricordo torna disponibile, entro quando andrebbe ripassato, e a quale livello
(Scan / Reinforcement / Focus) appartiene. Niente ease factor, niente
intervalli che derivano: la scala è quella delle tabelle di Maurizio,
uguale per tutti.

## La scala canonica

T0 = istante del salvataggio. Le prime due tappe si ancorano a T0; dalla
terza in poi il conteggio riparte dall'**ultimo ripasso riuscito**.

| Fase | Disponibile | Scadenza (finestra) | Layer |
|---|---|---|---|
| `p20h` | T0 + 20h | T0 + 48h | focus |
| `p48h` | T0 + 48h | T0 + 72h | focus |
| `p7d` | +7g | +8g | reinforcement |
| `p30d` | +30g | +32g | reinforcement |
| `p3m` | +90g | +94g | scan |
| `p6m` | +180g | +186g | scan |
| `p1y` | +365g | +385g | scan |
| `done` | mai (sentinella 2999) | — | scan |

## Risposte e transizioni

Le risposte sono **binarie** su ogni livello: `remembered` / `forgot`
(Maurizio 2026-08-29; l'intermedio "struggled" tornerà con un suo timing,
solo per item type dove un richiamo parziale ha senso — la colonna
`last_result` lo accetta già).

`applyReview(state, outcome, now)` ha tre rami:

1. **Ricordato in orario** → avanza alla fase successiva. L'ancoraggio
   segue la tabella: `p48h` si conta da **T0** (`created_at`, passato ad
   `applyReview` come `anchor.createdAt`), dalla terza tappa in poi da
   adesso. Senza T0 (carte demo) si riancora ad adesso.
2. **Ricordato ma oltre la finestra** (= la carta era in ritardo) → **ripete
   la stessa fase una volta** (screenshot 05), con finestra nuova da adesso.
   Non serve un contatore: il ripasso successivo, se puntuale, avanza da solo.
3. **Dimenticato** → recupero: fase `r24h` (disponibile tra 24 ore),
   `recovery_from` = la fase in cui si è dimenticato.

## Percorsi di recupero

"Dimenticato ≠ ricominciare tutto da zero" (screenshot 03). Il primo
recupero è sempre a +24h; al successo si rientra in un punto che dipende da
quanto era stabile il ricordo:

| Dimenticato in | Dopo `r24h` si va a | e da lì |
|---|---|---|
| `p20h` | `r48h` | → `p7d` → scala normale |
| `p48h`, `p7d` | `r3d` | → `p7d` → scala normale |
| `p30d` | `r7d` | → `p30d` → scala normale |
| `p3m` | `r14d` | → `p30d` → scala normale |
| `p6m` | `r30d` | → `p3m` → scala normale |
| `p1y`, `done` | `r2m` | → `p3m` → scala normale |

Dimenticare **durante** un recupero non lo rende più aggressivo:
`recovery_from` resta quello di partenza e si torna semplicemente a `r24h`.

## Sessioni di cartella, "Riequilibra ora" ed esercitazione (2026-09-08)

- **"Ripassa ora" di una cartella** = tutta la coda della cartella, di ogni
  fase, sulla carta Focus (`allPhases`). Prima era un singolo livello Scan,
  cioe' le sole fasi da tre mesi in su: una cartella nuova non partiva mai.
- **"Riequilibra ora"** (Salute) = la stessa sessione limitata alle carte con
  la finestra scaduta (`overdueOnly`, `review_window_end < now()`).
- **Mazzo vuoto** → `components/EmptyDeck.tsx`: "Hai del tempo libero?" con
  il solo "Aggiungi una nozione" (Add sulla cartella). Il tasto "Esercitati"
  e' stato tolto l'8/9/2026 (Angelo).
- **Esercitazione** (`practice`, review-store): tutte le parole della
  cartella, in coda o no, cap 28; NESSUNA persistenza (niente
  `review_sessions`, niente `review_items`, nessuna fase scritta). Il piano
  non cambia. Dall'8/9/2026 nessuna schermata la avvia: resta solo come
  modalita' della store.
- **Numero di ripassi** = `memories.review_count`, incrementato dal trigger
  `memories_count_review` a ogni cambio di `last_reviewed_at`
  (migration 20260908090000). Esatto da quel giorno; il pregresso e'
  `greatest(righe review_items, 1 se c'e' una data)`.

## Ritardo (fading) e archivio

- **In ritardo** = `review_window_end < now()`. Non è una colonna di stato né
  un job schedulato: è un confronto calcolato alla lettura, sempre corretto
  per costruzione. `fetchOverdueCount` lo usa per la sezione "Da recuperare".
- **`state` non si materializza piu' a `fading`** (2026-09-08). Lo stato che
  l'utente vede si calcola alla lettura in `mapMemory` con `lifecycleOf`
  (`features/srs/phases.ts`): `archived` resta quello scritto, `fading` =
  finestra scaduta ADESSO, altrimenti `active`. Dopo una risposta
  `applyPhaseUpdate` scrive sempre `active`: la finestra e' nuova. Prima
  Salute contava come "in dissolvenza" i ricordi ripassati ieri in ritardo e
  ignorava quelli scaduti oggi; "Riequilibra ora" apriva la cartella e non
  trovava nulla.
- Le carte in ritardo passano **davanti** nella coda della loro cartella
  (`allocateByFolderPriority`), ma la priorità delle cartelle resta il primo
  criterio.
- **`archived` non viene mai impostato dallo scheduler.** L'archiviazione
  automatica (screenshot 04: grace per fase dopo il fading, `graceMs` in
  `PHASE_SPEC`) è rimandata di proposito: entra solo insieme alla lista
  "Archiviati" con recupero a un tocco, altrimenti sarebbe perdita di dati
  silenziosa.

## I tre layer

Il layer si deduce dalla **fase** (`layerForPhase`), non più dal numero di
ripetizioni — il vecchio proxy sbagliava: a ease standard 4 ripetizioni
valevano ~37 giorni, quindi la fase "30 giorni" finiva in Scan invece che in
Reinforcement.

- **Focus** — `p20h`, `p48h`, `r24h`, `r48h` (i consolidamenti e i recuperi
  brevi, "ricordi di ieri")
- **Reinforcement** — `p7d`, `p30d`, `r3d`, `r7d`, `r14d`
- **Scan** — `p3m`, `p6m`, `p1y`, `done`, `r30d`, `r2m`

I predicati PostgREST usano `PHASES_BY_LAYER` (`lib/queue.ts`); ogni fase
appartiene a un solo layer, quindi i tre predicati sono mutuamente esclusivi
e nessuna carta compare due volte nel flusso Scan → Reinforcement → Focus.

Dentro un layer il mazzo è composto per **priorità di cartella** (l'ordine di
trascinamento in Cartelle, `folders.priority`): prima le carte della cartella
#1 (in ritardo prima, poi scadenza più vicina), poi la #2, fino al tetto del
layer. Pavimento: se il tetto può ospitare una carta per ogni cartella con
carte in coda, ogni cartella entra con la sua più urgente (2026-08-29).

Il tocco su una singola card di layer esegue solo quel layer
(`review_sessions.layer`).

## Colonne e codice

```
memories.review_phase       text, le 15 fasi (p* + r*), default 'p20h'
memories.next_review_at     timestamptz = inizio finestra (riusata da SM-2)
memories.review_window_end  timestamptz = fine finestra, null = non scade
memories.recovery_from      text, fase del "dimenticato" in corso di recupero
memories.last_result        text, ultima risposta (telemetria)
memories.srs_*              LEGACY: non più lette né scritte dallo scheduler;
                            si rimuovono con una migrazione futura, quando
                            nessun binario in circolazione le usa più
```

```
features/srs/
├── phases.ts        La scala: PHASE_SPEC, firstReview, applyReview, recuperi
├── phases.test.ts   35 test vitest: scala, finestre, layer, recuperi
└── types.ts         SrsState legacy + ri-export dei tipi di fase
```

Funzione pura: niente React, niente Supabase, niente I/O. `lib/api.ts`
persiste (`createMemory` semina `firstReview()`, `applyPhaseUpdate` scrive il
risultato), `lib/review-store.ts` orchestra (`phaseByCard`).

## Dimensione della sessione

La sessione propone **tutta la coda in scadenza**, fase per fase, senza tetto
(deciso il 4/9/2026, in codice dal 5/9). Fino ad allora la Home aveva un
selettore "Quanto tempo hai oggi?" (5 / 15 / 30 / 1 h) che ripartiva un tetto
di carte sulle tre fasi; è stato tolto perché la scelta non serviva a nulla —
l'utente vuole sapere cosa c'è da ripassare, non decidere quanto ignorarne.

I minuti mostrati restano una **stima**, non una scelta:
`SECONDS_PER_ITEM` in `lib/queue.ts` (20 / 35 / 40 s per Scan / Reinforcement /
Focus) × carte in coda, arrotondato per fase. Sono euristiche da tarare
quando ci sarà telemetria.

Il tetto per fase (`layerCaps`) esiste ancora nello store, ma la Home lo passa
**uguale alla coda**: serve all'handoff per saltare le fasi vuote. Le sessioni
per singola cartella (`/folder/[id]`) passano ancora `budgetCap: 28`.

Nota: `budgetCap` e' un tetto del mazzo di **ripasso** (quante carte entrano
nella sessione di una singola cartella), non di **inserimento**: non c'entra
ne' con il tetto di piano (10 ricordi totali sul Free, trigger `P0004`) ne'
con il cursore giornaliero di Impostazioni (`profiles.daily_input_cap`). Sono
tre numeri diversi per tre cose diverse.

## Edge cases

- **First review ever.** Un ricordo nuovo è programmato a **T0 + 20 ore** e
  NON entra subito in coda. La copy di Add mostra l'orario reale
  (`shortDateTime(firstReview().nextReviewAt)`) — il vecchio toast
  "primo ripasso domani, 8:00" era framing UX ed è stato rimosso il
  2026-09-02.
- **Long absence.** User skips a week. We don't penalize: le carte scadute
  diventano "in ritardo" e passano davanti, ma nessuna viene archiviata
  finché la lista Archiviati non esiste.
- **Daily input cap reached.** Adding new memories is throttled at 20/day
  (configurable in Settings). The error state on the Add screen is a soft
  warning, not a block — they can override. Il cap giornaliero
  (`profiles.daily_input_cap`) riguarda **Plus/Pro**: e' un'autoregolazione
  del carico, lato client, senza trigger. Per il **Free** Add mostra invece il
  totale di piano (`add.totalCounter` / `add.totalLimitReached`, 10 ricordi
  in tutto cestino compreso, Angelo 7/9/2026) e il solo blocco vero e' il
  trigger `P0004`; il cursore non gli morde mai perche' la sua opzione minima
  (`DAILY_CAP_OPTIONS`, `lib/constants.ts`) e' >= al tetto di piano. Vedi
  `docs/PAYMENTS.md` § I piani, "Limite giornaliero".
- **A folder with zero due items.** Knowledge shows the folder with retention
  bar full + no count badge. Tap still opens the folder list.
- **Time-zone drift.** `next_review_at` e `review_window_end` sono
  `timestamptz`; i confronti di scadenza sono assoluti (UTC), il
  raggruppamento per giorno nel futuro calendario userà la mezzanotte locale.
