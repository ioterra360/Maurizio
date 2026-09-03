import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { Tappable } from "@/components/Tappable";
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
  DEFAULT_REMINDER_SLOT,
  nextDailyTrigger,
  reminderSlots,
  slotFromProfileTime,
} from "@/lib/notifications-core";
import { reportError } from "@/lib/report-error";
import { safeBack } from "@/lib/safe-back";
import { useUIStore } from "@/lib/ui-store";
import { FONT, radii, useColors } from "@/theme/tokens";

const SLOTS = reminderSlots();
const NO_PERMISSION: PermissionState = { allowed: false, canAskAgain: false, undetermined: false };
/** Orizzonte del primo ripasso: T0+20h. Oltre non c'è niente da riarmare. */
const FIRST_REVIEW_HORIZON_MS = 20 * 60 * 60 * 1000;

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled || !p) return;
        setProfile(p);
        setCalmMode(p.calmMode);
        setSlot(slotFromProfileTime(p.morningReviewAt));
      })
      .catch((err) => reportError("notifications/profile-load", err));
    return () => {
      cancelled = true;
    };
  }, [user]);

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
  const slotsEnabled = active && !calmMode;

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
      await syncDailyReminder({ calmMode, morningReviewAt: slot });
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
      .then(() => syncDailyReminder({ calmMode: nextCalm, morningReviewAt: nextSlot }))
      .catch((err) => {
        reportError("notifications/profile-save", err);
        showToast(t("notifications.saveFailed"));
      });
  };

  const pickSlot = (value: string) => {
    if (!slotsEnabled || value === slot) return;
    tap();
    saveProfile({ morningReviewAt: value });
  };

  const onToggleFirstReview = (on: boolean) => {
    setPrefs({ firstReview: on });
    // setPrefs di zustand è sincrono: le due funzioni qui sotto leggono già
    // il valore nuovo da getState().
    if (on) void rearmFirstReviews();
    else void cancelAllFirstReviews();
  };

  const slotHint = calmMode
    ? t("notifications.slotSuspendedByCalm")
    : !active
      ? t("notifications.slotDisabled")
      : (() => {
          const next = nextDailyTrigger(slot);
          return next ? t("notifications.slotNext", { time: shortDateTime(next.toISOString()) }) : t("notifications.slotHint");
        })();

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

        {/* Orario del promemoria — lista di slot da mezz'ora (precedente: TimeBudgetChips). */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("notifications.slotSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              lineHeight: 19,
              color: colors.midGrey,
              marginBottom: 10,
            }}
          >
            {slotHint}
          </Text>
          {/* Niente opacità sul contenitore: le chip disattivate le sbiadisce
              già Tappable (opacity 0.5, components/Tappable.tsx:74) e in RN
              le due si moltiplicano — 0.45 × 0.5 = 0.225, testo navy
              illeggibile proprio al primo ingresso (modalità calma è
              `default true` a DB, quindi la griglia parte spenta). */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SLOTS.map((value) => {
              const on = value === slot;
              return (
                <Tappable
                  key={value}
                  onPress={() => pickSlot(value)}
                  disabled={!slotsEnabled}
                  accessibilityRole="button"
                  accessibilityLabel={t("notifications.slotA11y", { time: value })}
                  accessibilityState={{ selected: on }}
                  hitSlop={6}
                  pressedOpacity={0.7}
                  containerStyle={{ flexGrow: 1, flexBasis: "22%" }}
                  style={{
                    // 44 = area tattile minima iOS, come TimeBudgetChips
                    // (components/TimeBudgetChips.tsx:53). Con 48 chip fitti
                    // in griglia non è il posto dove risparmiare 4 punti.
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radii.chip,
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 13.5,
                      color: on ? colors.onAccent : colors.navy,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {value}
                  </Text>
                </Tappable>
              );
            })}
          </View>
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
          {/* I toggle sono uncontrolled: la key li rimonta quando arriva il
              profilo vero. La calma legge lo stato locale, non `profile`,
              così resta coerente anche quando il profilo è null. */}
          <SettingsToggle
            key={`calm-${calmMode}`}
            label={t("settings.calmMode")}
            hint={t("settings.calmModeHint")}
            defaultOn={calmMode}
            onChange={(v) => saveProfile({ calmMode: v })}
          />
          <SettingsToggle
            key={profile ? `digest-${profile.weeklyDigest}` : "digest"}
            label={t("settings.weeklyDigest")}
            hint={t("settings.weeklyDigestHint")}
            defaultOn={profile ? profile.weeklyDigest : false}
            onChange={(v) => saveProfile({ weeklyDigest: v })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
