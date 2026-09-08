# Promemoria solo nei giorni con qualcosa in coda (design, 2026-09-08)

Decisione di Angelo del 8/9/2026: "deve comparire la notifica solo se si
deve ripassare". Scartato il push dal server (build nativa nuova per FCM,
tabella token, fuso orario nel profilo, questionario privacy; spec
2026-09-02 §F3 lo esclude). Scelta la strada locale: l'app calcola in
anticipo i giorni con qualcosa in coda e programma una notifica datata per
ciascuno. Accettato il limite: chi non apre l'app per piu' di due
settimane smette di ricevere il promemoria finche' non la riapre.

## Perche' funziona senza server

Le date di ripasso sono deterministiche (scala di Maurizio, fissate al
salvataggio, in `memories.next_review_at`) e un ricordo in coda RESTA in
coda finche' non viene ripassato. Quindi basta un solo dato, la data di
ripasso piu' vicina fra i ricordi ripassabili, per sapere in quali dei
prossimi N giorni ci sara' qualcosa all'orario scelto: dal primo giorno
utile in poi, tutti. Lo stato cambia solo attraverso l'app (ripasso,
salvataggio, cestino, pausa), e l'app ricalcola a ogni passaggio in primo
piano e in background.

## 1. Regola

Il promemoria all'orario scelto (`profiles.morning_review_at`) arriva in un
giorno D solo se all'istante "D alle HH:MM" almeno un ricordo e'
ripassabile: `deleted_at is null`, `state <> 'archived'`, cartella non in
pausa, `next_review_at <= istante`. Stessi predicati della coda globale di
Oggi (`fetchDueMemoriesByLayer` senza `folderId`, `lib/api.ts`).

Invariati: permesso OS, interruttore principale, modalita' calma
(`shouldScheduleDaily`), l'avviso del primo ripasso a T0+20h, il testo
generico senza numeri (`notifications.dailyTitle/dailyBody`), il tocco che
porta a Oggi (`routeForPayload`, kind `daily`).

## 2. Calcolo

- `lib/api.ts`: `fetchEarliestDueAt(userId): Promise<string | null>`. Una
  riga: `select next_review_at from memories where user_id = ? and
  deleted_at is null and state <> 'archived' [and folder_id not in (cartelle
  in pausa)] order by next_review_at limit 1`. Nessun filtro is-not-null:
  `order by ... asc` mette i NULL in fondo (Postgres NULLS LAST), quindi la
  prima riga e' una data se ne esiste una; e un `.not(...)` in testa alla
  catena PostgREST manda tsc in "type instantiation excessively deep" alla
  riassegnazione del builder, come `.returns<>()` (cast al confine).
  Demo: `null`. Riusa `pausedFolderIds`.
- `lib/notifications-core.ts` (puro, testato):
  - `DAILY_HORIZON_DAYS = 14`, `DAILY_ID_PREFIX = "daily:"`,
    `dailyIdentifier(dayKey) = "daily:AAAA-MM-GG"`.
  - `dailyPlan({ earliestDueAt, slot, now, horizonDays }): Date[]`: per
    ogni giorno d in [0, H) costruisce l'istante locale (anno, mese,
    giorno+d, HH, MM) e lo tiene se e' nel futuro con margine
    (`MIN_LEAD_MS`) E `earliestDueAt <= istante`. `earliestDueAt` null o
    invalido, slot invalido: `[]`. Le date locali da componenti reggono
    cambio mese e ora legale, come `nextDailyTrigger` oggi.
  - `dailyPayload(dayKey)` = `{ kind: "daily", dayKey }`; `isDailyPayload`
    riconosce anche il payload vecchio `{ kind: "daily" }` (installazioni
    attuali).
  - Via `nextDailyTrigger` e `DAILY_REMINDER_ID` come costante viva: il
    vecchio identificatore `daily-reminder` resta solo come
    `LEGACY_DAILY_REMINDER_ID` da cancellare.
- `lib/notifications.ts`:
  - `syncDailyReminder(userId, profile): Promise<Date[] | null>`. Se
    `shouldScheduleDaily` e' falso: cancella ogni notifica in attesa con
    payload daily (compresa la legacy) e torna `[]`. Altrimenti legge
    `fetchEarliestDueAt`, calcola il piano, programma ogni istante con
    trigger `DATE` e identificatore `daily:<giorno>` (stesso id =
    sostituzione), poi cancella le daily in attesa non presenti nel piano.
    **`null` = piano NON ricalcolato** (notifiche non disponibili, lettura
    della coda fallita, sincronizzazione superata): il programma vecchio
    resta in attesa, e chi mostra "niente in coda" all'utente deve
    distinguerlo da `[]`, che significa "ho guardato e non c'e' niente".
  - **Generazione** (`dailySyncGen`): ogni sync ne prende una all'ingresso e
    dopo ogni attesa esce se non e' piu' l'ultima; `cancelAllReminders` la
    incrementa. Senza, due sincronizzazioni sovrapposte con input diversi
    (interruttore premuto due volte, primo piano mentre si cambia l'orario)
    si intrecciano, e una sync gia' partita riprogramma le sue date DOPO un
    "cancella tutto". Le prefs si rileggono anche subito prima di
    programmare, non solo all'ingresso.
  - **Lo slot di oggi in scadenza non si cancella**: `dailyPlan` scarta il
    giorno se lo slot e' entro `MIN_LEAD_MS`, ma quella notifica e' gia' in
    attesa nell'OS. `dailySlotAboutToFire(slot, now)` la risparmia:
    altrimenti un ricalcolo nei due secondi prima delle 08:00 perderebbe il
    promemoria del giorno.
  - `resyncDailyReminder(userId)`: `fetchProfile` + `syncDailyReminder`,
    per i punti che non hanno il profilo sotto mano. Stessa semantica di
    `null`.
  - `cancelAllReminders` invariata (cancella tutto) ma incrementa la
    generazione.

## 3. Quando si ricalcola

| Dove | Quando | Chiamata |
|---|---|---|
| `app/(app)/_layout.tsx` | mount con utente, AppState -> `active`, AppState -> `background` (non `inactive`: su iOS precede sempre `background` e raddoppierebbe il lavoro) | `resyncDailyReminder(userId)` (sostituisce l'effetto attuale) |
| `app/review/complete.tsx` | mount, DOPO `flushPersist()` | `resyncDailyReminder(userId)` |
| `app/add.tsx` | dopo il salvataggio (gia' presente) | `syncDailyReminder(userId, profile)` |
| `app/(app)/notifications.tsx` | mount con profilo, accensione, cambio calma/orario (gia' presenti) | `syncDailyReminder(userId, {calmMode, morningReviewAt})` e usa il risultato per la riga "Prossimo promemoria" |

**A fine sessione si aspetta la persistenza.** La scrittura di
`next_review_at` e' fire-and-forget e, sullo Scan, differita di 1,4 s per la
finestra di correzione (`lib/review-store.ts`). Senza attesa il ricalcolo di
`complete.tsx` rilegge le date VECCHIE, vede la carta appena ripassata come
ancora in coda e programma il promemoria di domani su una coda vuota: proprio
la notifica che questa modifica elimina. Lo store espone quindi
`flushPersist()` — chiude la finestra dello Scan e attende le scritture in
volo — e la schermata di fine sessione la aspetta prima del ricalcolo.

Cestino, ripristino, pausa e cancellazione cartella sono coperti dal
passaggio in background o in primo piano successivo. Il ricalcolo in
background e' best effort: se l'OS taglia il tempo, il primo piano
successivo rimette a posto.

## 4. Tetto iOS

iOS tiene al massimo 64 notifiche in attesa per app e scarta in silenzio
le piu' lontane. Con 14 giornaliere, `MAX_PENDING_FIRST_REVIEWS` scende
da 50 a 45: totale massimo 59, margine 5. Il test che vincola il tetto
sotto 64 va rafforzato: `MAX_PENDING_FIRST_REVIEWS + DAILY_HORIZON_DAYS < 64`.

## 5. Schermata Notifiche e testi (IT, EN, FR, ES)

- `notifications.dailySwitch`: "Ricordamelo ogni giorno" -> "Ricordamelo
  quando c'e' da ripassare".
- `notifications.dailySwitchHint`: "Un promemoria al giorno, all'ora che
  scegli." -> "All'ora che scegli, solo nei giorni in cui hai ricordi in
  coda."
- `notifications.slotNext` resta ("Prossimo promemoria: {time}") e mostra
  il primo istante del piano restituito da `syncDailyReminder`.
- Nuova `notifications.slotNone`: "Nessun promemoria nei prossimi {days}
  giorni: a quell'ora non c'e' niente in coda." (`{days}` interpolato da
  `DAILY_HORIZON_DAYS`, non scritto a mano). Il testo dice cio' che il piano
  controlla davvero, cioe' l'istante dello slot: un ricordo in scadenza il
  quattordicesimo giorno DOPO quell'ora non produce un promemoria, e "niente
  in coda nei prossimi 14 giorni" sarebbe falso.
- `tutorial.remindersBody`: "Dalle Impostazioni scegli un promemoria
  giornaliero e l'orario. ..." -> "Dalle Impostazioni scegli l'orario del
  promemoria: arriva solo nei giorni con qualcosa da ripassare. Io ti
  avviso anche quando il primo ripasso e' pronto."
- Lo stato "prossimo promemoria" nella schermata e' uno `useState<Date |
  null | undefined>`: `undefined` = non ancora calcolato (nessuna riga, ed
  e' anche lo stato durante un ricalcolo), `null` = piano vuoto davvero.
  Un `null` di ritorno da `syncDailyReminder` NON tocca lo stato. Con
  interruttore spento o calma accesa valgono i testi di oggi.

## 6. Test

- `lib/notifications-core.test.ts`: `dailyPlan` con (a) nulla in coda ->
  `[]`; (b) ricordo in ritardo, ore 07:00, slot 08:00 -> 14 istanti da
  oggi; (c) stesso ma ore 09:00 -> 13 istanti da domani (l'orizzonte e'
  di 14 giorni DA OGGI, oggi e' passato); (d) ricordo che
  entra in coda il giorno 5 alle 10:00 con slot 08:00 -> istanti dal
  giorno 6; (e) ricordo oltre l'orizzonte -> `[]`; (f) cambio mese; (g)
  slot invalido -> `[]`. `dailyIdentifier`, `isDailyPayload` vecchio e
  nuovo, tetto `MAX_PENDING_FIRST_REVIEWS + DAILY_HORIZON_DAYS < 64`. Via i
  test di `nextDailyTrigger`.
- `lib/api.earliest-due.test.ts` (impianto registratore di
  `api.plan-counters.test.ts`): forma della query (nessun `not` senza
  cartelle in pausa, nessun confronto con "adesso"), filtro cartelle in
  pausa, `null` senza righe, errore che si propaga.
- `lib/i18n/i18n.test.ts` gia' vincola le chiavi in tutte le lingue.

## 7. Documenti

`docs/DATA-MODEL.md` (righe `calm_mode`, `morning_review_at`): il
promemoria e' programmato solo nei giorni con qualcosa in coda, orizzonte
14 giorni. `docs/DEPLOY.md` checklist (riga 735) e `docs/ROADMAP.md` (riga
181): "one daily reminder" -> "promemoria nei giorni con coda".

## Fuori scope

- Screenshot del passo "Notifiche" del tutorial (`assets/tutorial/`,
  etichetta vecchia dell'interruttore): da rigenerare con
  `scripts/tutorial-shots/` in un giro a parte.
- Push dal server: riconsiderare solo se servira' il promemoria oltre le
  due settimane senza aprire l'app o su piu' dispositivi.
- Nessuna dipendenza nuova, `app.json` intatto: esce in OTA.
