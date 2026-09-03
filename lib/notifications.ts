/**
 * Notifiche locali — il wrapper su expo-notifications (spec 2026-09-02 §F3).
 *
 * È l'UNICO file che importa expo-notifications. Regole:
 *  - solo locali: nessun token push, nessun server;
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

import { NOTIFICATIONS_ENABLED } from "./constants";
import { t } from "@/lib/i18n";
import type { Memory, Profile } from "./mappers";
import { useNotificationPrefsStore } from "./notification-prefs-store";
import {
  DAILY_REMINDER_ID,
  REMINDER_CHANNEL_ID,
  canScheduleAt,
  dailyPayload,
  firstReviewIdentifier,
  firstReviewPayload,
  isFirstReviewInFolder,
  isFirstReviewPayload,
  parseSlot,
  routeForPayload,
  shouldScheduleDaily,
  shouldScheduleFirstReview,
  slotFromProfileTime,
  type NotificationRoute,
} from "./notifications-core";
import { reportError } from "./report-error";
import { isDemoMode } from "./supabase";

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
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: firstReviewIdentifier(memory.id),
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
 * Riallinea il promemoria giornaliero a profilo + prefs + permesso. È
 * l'unico punto che lo programma o lo cancella: chiamarlo è sempre
 * corretto, in qualunque stato ci si trovi. Profilo null (demo, errore di
 * rete) = calma accesa = niente promemoria.
 */
export async function syncDailyReminder(
  profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null,
): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    const prefs = useNotificationPrefsStore.getState().prefs;
    const perm = await getPermission();
    const calmMode = profile?.calmMode ?? true;
    if (!shouldScheduleDaily({ enabled: prefs.enabled, calmMode, allowed: perm.allowed })) {
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
      return;
    }
    const slot = parseSlot(slotFromProfileTime(profile?.morningReviewAt));
    if (!slot) {
      // Oggi irraggiungibile (slotFromProfileTime torna sempre uno slot
      // valido), ma se le due funzioni divergessero un `return` secco
      // lascerebbe programmato l'orario VECCHIO mentre il profilo ne dice
      // un altro. Meglio uscire senza promemoria che con quello sbagliato.
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
      return;
    }
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: t("notifications.dailyTitle"),
        body: t("notifications.dailyBody"),
        data: dailyPayload(),
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch (e) {
    reportError("notifications/sync-daily", e);
  }
}

/** Interruttore principale spento: niente resta in attesa. */
export async function cancelAllReminders(): Promise<void> {
  if (!notificationsAvailable()) return;
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
