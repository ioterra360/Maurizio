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

1. **Ricordato in orario** → avanza alla fase successiva, riancorata ad
   adesso.
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

## Ritardo (fading) e archivio

- **In ritardo** = `review_window_end < now()`. Non è una colonna di stato né
  un job schedulato: è un confronto calcolato alla lettura, sempre corretto
  per costruzione. `fetchOverdueCount` lo usa per la sezione "Da recuperare".
- La colonna `state` viene materializzata a `fading` quando l'utente
  **risponde** a una carta la cui finestra era scaduta.
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

## Time-budget chips

5 / 15 / 30 / 1 hr. They cap the number of memories per session, not the wall
clock. Approximations:

| Budget | Items |
|---|---|
| 5 min | 8-10 |
| 15 min | 25-30 |
| 30 min | 50-60 |
| 1 hr | 100-120 |

These are heuristics. We'll measure actual session length once we have
telemetry (Sentry breadcrumbs).

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
  warning, not a block — they can override.
- **A folder with zero due items.** Knowledge shows the folder with retention
  bar full + no count badge. Tap still opens the folder list.
- **Time-zone drift.** `next_review_at` e `review_window_end` sono
  `timestamptz`; i confronti di scadenza sono assoluti (UTC), il
  raggruppamento per giorno nel futuro calendario userà la mezzanotte locale.
