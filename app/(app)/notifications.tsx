import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { TimeWheelSheet } from "@/components/TimeWheelSheet";
import { TopBar } from "@/components/TopBar";
import { fetchMemoriesInRange, fetchProfile, updateProfile } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { tap } from "@/lib/feedback";
import { shortDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/mappers";
import { useNotificationPrefsStore } from "@/lib/notification-prefs-store";
import {
  cancelAllFirstReviews,
  cancelAllReminders,
  getPermission,
  openSystemNotificationSettings,
  requestPermission,
  scheduleFirstReview,
  syncDailyReminder,
  type PermissionState,
} from "@/lib/notifications";
import {
  DAILY_HORIZON_DAYS,
  DEFAULT_REMINDER_SLOT,
  slotFromProfileTime,
} from "@/lib/notifications-core";
import { reportError } from "@/lib/report-error";
import { safeBack } from "@/lib/safe-back";
import { useUIStore } from "@/lib/ui-store";
import { useColors } from "@/theme/tokens";

const NO_PERMISSION: PermissionState = { allowed: false, canAskAgain: false, undetermined: false };
/** Orizzonte del primo ripasso: T0+20h. Oltre non c'è niente da riarmare. */
const FIRST_REVIEW_HORIZON_MS = 20 * 60 * 60 * 1000;
// L'orizzonte NON è un tetto: dentro 20 ore possono starci centinaia di
// ricordi. Il tetto della coda è MAX_PENDING_FIRST_REVIEWS (50) e vive in
// lib/notifications-core.ts, applicato da scheduleFirstReview — iOS tiene al
// massimo 64 richieste in attesa e scarta le altre in silenzio. Il riarmo qui
// sotto non ne ha uno proprio: fetchMemoriesInRange ordina per
// next_review_at crescente (lib/api.ts), quindi il ciclo incontra i più
// imminenti per primi e il tetto conserva quelli.

/**
 * Notifiche (spec 2026-09-02 §F3): tab nascosto, raggiunto da Impostazioni.
 *
 * Schermata deliberatamente MISTA: due preferenze di dispositivo (store:
 * interruttore principale, "Avvisami") e tre righe di profilo (orario,
 * modalità calma, riepilogo). L'orario riusa profiles.morning_review_at.
 *
 * Tre cancelli per il promemoria giornaliero — permesso OS, interruttore,
 * calma spenta — e la schermata dice quale è chiuso invece di mostrare un
 * orario che non scatterà mai.
 */
export default function NotificationsScreen() {
  const { t } = useT();
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const setPrefs = useNotificationPrefsStore((s) => s.setPrefs);

  // Profilo vero (null in demo: fetchProfile torna null, lib/api.ts:63).
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permission, setPermission] = useState<PermissionState>(NO_PERMISSION);
  // Calma e orario stanno in uno stato PROPRIO, non derivati da `profile`:
  // con profilo null (demo, errore di rete) `profile?.calmMode ?? true`
  // resterebbe true anche dopo che l'utente ha spento l'interruttore, e la
  // griglia degli slot resterebbe grigia sotto un toggle che dice il
  // contrario. Qui l'idratazione arriva dal profilo, l'aggiornamento dal
  // gesto — e i due non si contraddicono mai.
  const [calmMode, setCalmMode] = useState(true);
  const [slot, setSlot] = useState<string>(DEFAULT_REMINDER_SLOT);
  // Rimonta l'interruttore principale dopo un tentativo fallito: il Switch
  // di SettingsToggle è uncontrolled (components/SettingsRow.tsx:109) e su
  // un rifiuto del permesso nessuno dei valori della key cambia.
  const [switchNonce, setSwitchNonce] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Primo istante del piano programmato: undefined = non ancora calcolato
  // (niente riga), null = niente in coda nei prossimi DAILY_HORIZON_DAYS.
  const [nextAt, setNextAt] = useState<Date | null | undefined>(undefined);
  const syncDaily = useCallback(
    async (calm: boolean, s: string) => {
      if (!user) return;
      // Durante il ricalcolo la riga sparisce invece di mostrare il valore
      // vecchio come se fosse quello nuovo.
      setNextAt(undefined);
      const plan = await syncDailyReminder(user.id, { calmMode: calm, morningReviewAt: s });
      // null = piano NON ricalcolato (rete caduta, cancelli chiusi, sync
      // superata da una piu' recente): il programma vecchio resta in attesa
      // nell'OS, quindi annunciare "niente in coda" sarebbe falso.
      if (plan) setNextAt(plan[0] ?? null);
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled || !p) return;
        setProfile(p);
        setCalmMode(p.calmMode);
        setSlot(slotFromProfileTime(p.morningReviewAt));
        void syncDaily(p.calmMode, slotFromProfileTime(p.morningReviewAt));
      })
      .catch((err) => reportError("notifications/profile-load", err));
    return () => {
      cancelled = true;
    };
  }, [user, syncDaily]);

  // Il permesso si rilegge a ogni focus: l'utente può tornare dalle
  // impostazioni del telefono avendolo appena cambiato.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPermission().then((p) => {
        if (!cancelled) setPermission(p);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const active = prefs.enabled && permission.allowed;
  // "Promemoria giornaliero" acceso = modalita' calma spenta: e' lo stesso
  // dato (profiles.calm_mode) letto al contrario. Prima la calma era un
  // interruttore piu' in basso e l'orario restava grigio senza spiegazione.
  const dailyEnabled = active && !calmMode;

  /**
   * Riaccensione: spegnere un cancello CANCELLA i primi ripassi già in
   * attesa, e nessuno li riprogramma — `scheduleFirstReview` gira solo al
   * salvataggio e al ripristino. Senza questo, spegni-e-riaccendi perde in
   * silenzio l'avviso di ogni ricordo delle ultime 20 ore. Si riarma dalla
   * sorgente di verità, non da una cache: la coda vera dentro l'orizzonte.
   * `scheduleFirstReview` scarta da sola fasi diverse da p20h e date
   * passate, quindi qui non serve nessun `if`.
   */
  const rearmFirstReviews = async () => {
    if (!user) return;
    try {
      const now = Date.now();
      const items = await fetchMemoriesInRange(
        user.id,
        new Date(now).toISOString(),
        new Date(now + FIRST_REVIEW_HORIZON_MS).toISOString(),
      );
      for (const m of items) await scheduleFirstReview(m);
    } catch (err) {
      reportError("notifications/rearm-first-reviews", err);
    }
  };

  const onToggleMain = async (on: boolean) => {
    if (!on) {
      setPrefs({ enabled: false });
      await cancelAllReminders();
      return;
    }
    const perm = await requestPermission();
    setPermission(perm);
    if (perm.allowed) {
      setPrefs({ enabled: true });
      await syncDaily(calmMode, slot);
      await rearmFirstReviews();
      return;
    }
    // Negato: il nonce rimonta lo Switch, che torna visivamente spento
    // (senza, la key non cambierebbe e la schermata direbbe "acceso" con
    // tutti i cancelli chiusi). E se il sistema non ci lascia più chiedere,
    // si apre la strada giusta.
    setPrefs({ enabled: false });
    setSwitchNonce((n) => n + 1);
    showToast(t("notifications.deniedToast"));
    if (!perm.canAskAgain) openSystemNotificationSettings();
  };

  const saveProfile = (patch: Partial<Pick<Profile, "calmMode" | "weeklyDigest" | "morningReviewAt">>) => {
    if (!user) return;
    // Lo stato locale si muove PRIMA della rete: l'interruttore e la
    // griglia devono raccontare la stessa cosa anche con profilo null.
    if (profile) setProfile({ ...profile, ...patch });
    const nextCalm = patch.calmMode ?? calmMode;
    const nextSlot = patch.morningReviewAt ?? slot;
    if (patch.calmMode !== undefined) setCalmMode(patch.calmMode);
    if (patch.morningReviewAt !== undefined) setSlot(patch.morningReviewAt);
    updateProfile(user.id, patch)
      .then(() => syncDaily(nextCalm, nextSlot))
      .catch((err) => {
        reportError("notifications/profile-save", err);
        showToast(t("notifications.saveFailed"));
      });
  };

  const pickSlot = (value: string) => {
    setSheetOpen(false);
    if (!dailyEnabled || value === slot) return;
    saveProfile({ morningReviewAt: value });
  };

  const onToggleFirstReview = (on: boolean) => {
    setPrefs({ firstReview: on });
    // setPrefs di zustand è sincrono: le due funzioni qui sotto leggono già
    // il valore nuovo da getState().
    if (on) void rearmFirstReviews();
    else void cancelAllFirstReviews();
  };

  const slotHint = !active
    ? t("notifications.slotDisabled")
    : calmMode
      ? t("notifications.slotDisabledByToggle")
      : nextAt === undefined
        ? ""
        : nextAt
          ? t("notifications.slotNext", { time: shortDateTime(nextAt.toISOString()) })
          : t("notifications.slotNone", { days: DAILY_HORIZON_DAYS });

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("notifications.title")} onBack={() => safeBack("/(app)/settings")} />
      {/* 140 come l'altro tab nascosto di questo navigator (app/(app)/upcoming.tsx:115):
          sotto c'è la barra sfocata, 120 ci finiscono dentro. */}
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Interruttore principale — specchio del permesso OS su questo telefono. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <SettingsToggle
            key={`master-${prefs.enabled && permission.allowed}-${switchNonce}`}
            label={t("notifications.masterSwitch")}
            hint={t("notifications.masterSwitchHint")}
            defaultOn={prefs.enabled && permission.allowed}
            onChange={(v) => void onToggleMain(v)}
          />
          {prefs.enabled && !permission.allowed ? (
            <SettingsRow
              label={t("notifications.systemBlocked")}
              value={t("notifications.openSystemSettings")}
              chevron
              onPress={() => {
                tap();
                openSystemNotificationSettings();
              }}
            />
          ) : null}
        </View>

        {/* Promemoria giornaliero: interruttore (= calma al contrario) e, sotto,
            l'orario che apre il foglio a rulli. La griglia da 48 caselle e'
            sparita il 6/9/2026. */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("notifications.dailySection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsToggle
            key={`daily-${!calmMode}-${active}`}
            label={t("notifications.dailySwitch")}
            hint={t("notifications.dailySwitchHint")}
            defaultOn={!calmMode}
            onChange={(v) => saveProfile({ calmMode: !v })}
          />
          <SettingsRow
            label={t("notifications.slotRow")}
            hint={slotHint || undefined}
            value={slot}
            chevron={dailyEnabled}
            onPress={
              dailyEnabled
                ? () => {
                    tap();
                    setSheetOpen(true);
                  }
                : undefined
            }
          />
        </View>

        {/* Avviso del primo ripasso + le due preferenze di profilo. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 10 }}>
          <SettingsToggle
            key={`first-${prefs.firstReview}`}
            label={t("notifications.firstReviewSwitch")}
            hint={t("notifications.firstReviewSwitchHint")}
            defaultOn={prefs.firstReview}
            onChange={onToggleFirstReview}
          />
          {/* "Riepilogo settimanale" NON e' qui: prometteva una funzione che non
              esiste ("arrivera' in un prossimo aggiornamento"). Tolto il 7/9/2026
              finche' non c'e' davvero; il flag profiles.weekly_digest resta. */}
        </View>
      </ScrollView>
      <TimeWheelSheet visible={sheetOpen} value={slot} onConfirm={pickSlot} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}
