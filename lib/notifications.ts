/**
 * Notifiche locali — il wrapper su expo-notifications (spec 2026-09-02 §F3).
 *
 * È l'UNICO file che importa expo-notifications. Regole:
 *  - solo locali: nessun token push, nessun server;
 *  - il promemoria e' un piano di notifiche DATATE, una per giorno con
 *    qualcosa in coda (spec 2026-09-08), non un trigger giornaliero;
 *  - ogni funzione esce subito se le notifiche non sono disponibili
 *    (flag NOTIFICATIONS_ENABLED spento, o demo mode);
 *  - nessuna funzione lancia: gli errori passano da reportError e i call
 *    site fanno `void fn()`;
 *  - la logica pura sta in lib/notifications-core.ts (testata); qui c'è
 *    solo l'I/O con l'OS.
 *
 * In Expo Go la libreria emette un warn all'import e le notifiche locali
 * funzionano; il plugin (icona Android) no — il test vero si fa sulla build 3.
 */

import * as Notifications from "expo-notifications";
import {
  AndroidImportance,
  DEFAULT_ACTION_IDENTIFIER,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  type NotificationPermissionsStatus,
  type NotificationResponse,
} from "expo-notifications";
import { Linking, Platform } from "react-native";

import { fetchEarliestDueAt, fetchProfile } from "./api";
import { NOTIFICATIONS_ENABLED } from "./constants";
import { t } from "@/lib/i18n";
import type { Memory, Profile } from "./mappers";
import { useNotificationPrefsStore } from "./notification-prefs-store";
import {
  LEGACY_DAILY_REMINDER_ID,
  REMINDER_CHANNEL_ID,
  canScheduleAt,
  dailyIdentifierFor,
  dailyPayload,
  dailyPlan,
  dailySlotAboutToFire,
  firstReviewCapReached,
  firstReviewIdentifier,
  firstReviewPayload,
  isDailyPayload,
  isFirstReviewInFolder,
  isFirstReviewPayload,
  routeForPayload,
  shouldScheduleDaily,
  shouldScheduleFirstReview,
  slotFromProfileTime,
  type NotificationRoute,
} from "./notifications-core";
import { reportError } from "./report-error";
import { isDemoMode } from "./supabase";
import { dayKeyOf } from "./upcoming";

/** Il flag lo flippa il piano di configurazione nativa (build 3); in demo l'OS non si tocca mai. */
export function notificationsAvailable(): boolean {
  return NOTIFICATIONS_ENABLED && !isDemoMode;
}

/**
 * Come mostrare una notifica che arriva con l'app in PRIMO PIANO. Senza
 * handler l'OS non la mostra affatto. Va chiamato una volta, a livello di
 * modulo, nel root layout. Niente badge: Memika non conta niente in rosso.
 */
export function installNotificationHandler(): void {
  if (!notificationsAvailable()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canale Android; su iOS è un no-op. Importanza DEFAULT: un promemoria, non un allarme. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: t("notifications.channelName"),
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    showBadge: false,
  });
}

export type PermissionState = {
  /** Possiamo programmare. Su iOS anche PROVISIONAL (consegna silenziosa) conta come sì. */
  allowed: boolean;
  /** false = l'utente ha negato: solo le impostazioni del telefono possono riaprire. */
  canAskAgain: boolean;
  /** Mai chiesto su questo telefono: il pre-prompt ha senso solo qui. */
  undetermined: boolean;
};

const UNAVAILABLE: PermissionState = { allowed: false, canAskAgain: false, undetermined: false };

function toPermissionState(s: NotificationPermissionsStatus): PermissionState {
  return {
    allowed: s.granted || s.ios?.status === IosAuthorizationStatus.PROVISIONAL,
    canAskAgain: s.canAskAgain,
    // `status` è l'enum stringa di expo-modules-core; il confronto testuale
    // evita di importare quel pacchetto solo per una costante.
    undetermined: String(s.status) === "undetermined",
  };
}

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsAvailable()) return UNAVAILABLE;
  try {
    return toPermissionState(await Notifications.getPermissionsAsync());
  } catch (e) {
    reportError("notifications/get-permission", e);
    return UNAVAILABLE;
  }
}

/**
 * Chiede il permesso di sistema. Su iOS il foglio compare UNA volta per
 * installazione: dopo un "no" resta solo Impostazioni. Per questo chi
 * chiama deve farlo solo su un'azione esplicita dell'utente.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsAvailable()) return UNAVAILABLE;
  try {
    const current = toPermissionState(await Notifications.getPermissionsAsync());
    if (current.allowed || !current.canAskAgain) return current;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return toPermissionState(next);
  } catch (e) {
    reportError("notifications/request-permission", e);
    return UNAVAILABLE;
  }
}

/**
 * Apre le impostazioni di sistema dell'app. La guardia non è decorativa: in
 * demo (o a flag spento) `requestPermission` torna UNAVAILABLE, che ha
 * `canAskAgain: false`, e senza guardia il ramo "non possiamo più chiedere"
 * della schermata butterebbe l'utente fuori da Memika. In demo l'OS non si
 * tocca, mai.
 */
export function openSystemNotificationSettings(): void {
  if (!notificationsAvailable()) return;
  Linking.openSettings().catch((e) => reportError("notifications/open-settings", e));
}

/**
 * "Primo ripasso pronto" per UN ricordo, all'istante esatto di
 * nextReviewAt (T0+20h). Solo per la fase p20h: le fasi successive non
 * avvisano. Identificatore stabile → ri-programmare sostituisce.
 *
 * È l'UNICO punto che crea una richiesta di primo ripasso, quindi è qui che
 * sta il tetto della coda (MAX_PENDING_FIRST_REVIEWS, lib/notifications-core.ts).
 */
export async function scheduleFirstReview(
  memory: Pick<Memory, "id" | "folderId" | "term" | "nextReviewAt" | "phase">,
): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    if (memory.phase !== "p20h") return;
    if (!canScheduleAt(memory.nextReviewAt)) return;
    const prefs = useNotificationPrefsStore.getState().prefs;
    const perm = await getPermission();
    if (!shouldScheduleFirstReview({ enabled: prefs.enabled, firstReview: prefs.firstReview, allowed: perm.allowed })) {
      return;
    }
    // Tetto della coda (MAX_PENDING_FIRST_REVIEWS): oltre 64 richieste in
    // attesa iOS scarta in silenzio, e la prima a cadere sarebbe il
    // promemoria giornaliero. Il controllo sta QUI e non solo nel riarmo
    // perché il percorso di Add arriva allo stesso totale un salvataggio
    // alla volta ("Salva e aggiungi un altro"). Costa un round trip nativo
    // per salvataggio, sulla stessa scia dell'await di getPermission().
    const identifier = firstReviewIdentifier(memory.id);
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const mine = pending.filter((r) => isFirstReviewPayload(r.content.data)).map((r) => r.identifier);
    if (firstReviewCapReached(mine, identifier)) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: t("notifications.firstReviewTitle"),
        body: t("notifications.firstReviewBody", { term: memory.term }),
        data: firstReviewPayload(memory.id, memory.folderId),
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: Date.parse(memory.nextReviewAt),
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch (e) {
    reportError("notifications/schedule-first-review", e);
  }
}

/** Idempotente: risolve anche se per quell'id non c'è nulla in attesa. */
export async function cancelFirstReview(memoryId: string): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(firstReviewIdentifier(memoryId));
  } catch (e) {
    reportError("notifications/cancel-first-review", e);
  }
}

async function cancelFirstReviewsWhere(keep: (data: unknown) => boolean, tag: string): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    // Il trigger torna in forma NATIVA (diversa fra iOS e Android): si
    // filtra sul payload, mai sul trigger.
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const mine = pending.filter((r) => keep(r.content.data));
    await Promise.all(mine.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
  } catch (e) {
    reportError(tag, e);
  }
}

/** Cestino di una cartella: deleteFolder non restituisce gli id, il payload sì. */
export function cancelFirstReviewsInFolder(folderId: string): Promise<void> {
  return cancelFirstReviewsWhere((d) => isFirstReviewInFolder(d, folderId), "notifications/cancel-folder");
}

/** "Avvisami" spento: via tutti i primi ripassi in attesa, il giornaliero resta. */
export function cancelAllFirstReviews(): Promise<void> {
  return cancelFirstReviewsWhere(isFirstReviewPayload, "notifications/cancel-all-first-reviews");
}

/**
 * Generazione della sincronizzazione del promemoria. Ogni `syncDailyReminder`
 * ne prende una all'ingresso; `cancelAllReminders` la incrementa. Dopo ogni
 * attesa (rete, chiamate native) chi non e' piu' l'ultimo esce SENZA toccare
 * l'OS: due sincronizzazioni sovrapposte con input diversi — l'interruttore
 * premuto due volte, un ritorno in primo piano mentre l'utente cambia
 * l'orario — altrimenti si intrecciano e lasciano nell'OS un insieme che non
 * e' ne' l'uno ne' l'altro. Vale anche contro "cancella tutto": senza questo,
 * una sync gia' partita riprogrammerebbe le sue date DOPO la cancellazione.
 */
let dailySyncGen = 0;

/**
 * Riallinea il promemoria a profilo + prefs + permesso + CODA. Dall'8/9/2026
 * non e' piu' un trigger "ogni giorno": e' una notifica DATATA per ciascuno
 * dei prossimi DAILY_HORIZON_DAYS giorni in cui, all'orario scelto, c'e'
 * almeno un ricordo in coda (dailyPlan su fetchEarliestDueAt). E' l'unico
 * punto che le programma o le cancella: chiamarlo e' sempre corretto, in
 * qualunque stato. Profilo null (demo, errore di rete) = calma accesa =
 * niente promemoria.
 *
 * Torna gli istanti programmati (il primo e' la riga "Prossimo promemoria"
 * della schermata Notifiche) oppure **null quando il piano NON e' stato
 * ricalcolato**: notifiche non disponibili, lettura della coda fallita, o
 * sincronizzazione superata da una piu' recente. Un array vuoto significa
 * una cosa sola: ho guardato e non c'e' niente da programmare. Chi mostra
 * "niente in coda" all'utente deve distinguere i due casi, altrimenti
 * annuncia una coda vuota mentre il programma vecchio e' ancora in attesa.
 */
export async function syncDailyReminder(
  userId: string,
  profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null,
): Promise<Date[] | null> {
  if (!notificationsAvailable()) return null;
  const gen = ++dailySyncGen;
  try {
    const perm = await getPermission();
    if (gen !== dailySyncGen) return null;
    const calmMode = profile?.calmMode ?? true;
    const slot = slotFromProfileTime(profile?.morningReviewAt);
    // Le prefs si rileggono qui e di nuovo prima di programmare: fra le due
    // c'e' la rete, e l'utente puo' spegnere l'interruttore nel frattempo.
    if (
      !shouldScheduleDaily({
        enabled: useNotificationPrefsStore.getState().prefs.enabled,
        calmMode,
        allowed: perm.allowed,
      })
    ) {
      await cancelDailyExcept(new Set(), slot);
      return [];
    }
    let earliestDueAt: string | null;
    try {
      earliestDueAt = await fetchEarliestDueAt(userId);
    } catch (e) {
      // Rete assente: meglio il programma stantio in attesa che nessuno.
      // Il prossimo primo piano rimette a posto. Null, non []: non e' una
      // coda vuota, e' una lettura mancata.
      reportError("notifications/sync-daily-fetch", e);
      return null;
    }
    if (gen !== dailySyncGen) return null;
    const now = new Date();
    const plan = dailyPlan({ earliestDueAt, slot, now });
    // Ricontrollo dopo la rete: l'interruttore puo' essere stato spento
    // mentre la query era in volo.
    if (!useNotificationPrefsStore.getState().prefs.enabled) return null;
    if (plan.length > 0) await ensureChannel();
    for (const at of plan) {
      if (gen !== dailySyncGen) return null;
      // Stesso identificatore = sostituzione: un cambio di orario riscrive
      // il giorno senza duplicarlo.
      await Notifications.scheduleNotificationAsync({
        identifier: dailyIdentifierFor(at),
        content: {
          title: t("notifications.dailyTitle"),
          body: t("notifications.dailyBody"),
          data: dailyPayload(dayKeyOf(at)),
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: at.getTime(),
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    }
    if (gen !== dailySyncGen) return null;
    await cancelDailyExcept(new Set(plan.map(dailyIdentifierFor)), slot, now);
    return plan;
  } catch (e) {
    reportError("notifications/sync-daily", e);
    return null;
  }
}

/**
 * Cancella le notifiche del promemoria in attesa (payload daily, compreso
 * il vecchio "daily-reminder" delle installazioni attuali) tranne quelle
 * in `keep`. Si filtra sul payload e sull'identificatore, mai sul trigger,
 * che torna in forma nativa diversa fra iOS e Android.
 *
 * `slot` protegge il promemoria di OGGI negli ultimi due secondi prima che
 * suoni: `dailyPlan` non puo' programmarlo cosi' a ridosso, quindi non e'
 * nel piano, ma e' gia' in attesa nell'OS e cancellarlo lo perderebbe.
 */
async function cancelDailyExcept(
  keep: ReadonlySet<string>,
  slot?: string,
  now: Date = new Date(),
): Promise<void> {
  const spared = new Set(keep);
  if (slot && dailySlotAboutToFire(slot, now)) spared.add(dailyIdentifierFor(now));
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const stale = pending.filter(
    (r) =>
      (isDailyPayload(r.content.data) || r.identifier === LEGACY_DAILY_REMINDER_ID) &&
      !spared.has(r.identifier),
  );
  await Promise.all(stale.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
}

/**
 * Per chi non ha il profilo sotto mano (layout, fine sessione): lo legge
 * e riallinea. Null = non ricalcolato (vedi `syncDailyReminder`): un errore
 * di rete lascia in attesa il programma vecchio.
 */
export async function resyncDailyReminder(userId: string): Promise<Date[] | null> {
  if (!notificationsAvailable()) return null;
  try {
    const profile = await fetchProfile(userId);
    return await syncDailyReminder(userId, profile);
  } catch (e) {
    reportError("notifications/resync-daily", e);
    return null;
  }
}

/** Interruttore principale spento: niente resta in attesa. */
export async function cancelAllReminders(): Promise<void> {
  if (!notificationsAvailable()) return;
  // Invalida le sincronizzazioni in volo: una che avesse gia' letto la coda
  // riprogrammerebbe le sue date subito DOPO questa cancellazione.
  dailySyncGen++;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    reportError("notifications/cancel-all", e);
  }
}

function routeForResponse(r: NotificationResponse | null): NotificationRoute | null {
  if (!r || r.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return null;
  return routeForPayload(r.notification.request.content.data);
}

/**
 * Tocco su una notifica. Avvio a freddo: la risposta che ha lanciato l'app
 * si legge in modo sincrono e si CANCELLA, altrimenti un reload la
 * rinavigherebbe. App viva: il listener. Torna l'unsubscribe.
 */
export function subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void {
  if (!notificationsAvailable()) return () => {};
  try {
    const cold = Notifications.getLastNotificationResponse();
    if (cold) {
      Notifications.clearLastNotificationResponse();
      const route = routeForResponse(cold);
      if (route) onRoute(route);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForResponse(response);
      if (route) onRoute(route);
    });
    return () => sub.remove();
  } catch (e) {
    reportError("notifications/subscribe-taps", e);
    return () => {};
  }
}
