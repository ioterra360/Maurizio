import { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { LogOut, Trash2, AlertTriangle, ExternalLink } from "lucide-react-native";

import { HeaderHero } from "@/components/HeaderHero";
import { InitialsAvatar } from "@/components/FolderTile";
import { SectionLabel } from "@/components/SectionLabel";
import { useLocaleStore, useT, type LocalePreference, type TKey } from "@/lib/i18n";
import { useThemeStore } from "@/theme/theme-store";
import type { ThemePreference } from "@/theme/theme-store";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useReviewStore } from "@/lib/review-store";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { fetchDeletionPreview, fetchProfile, requestAccountDeletion, updateProfile } from "@/lib/api";
import {
  ACCOUNT_DELETION_URL,
  NOTIFICATIONS_ENABLED,
  PRIVACY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from "@/lib/constants";
import { formatAppVersion } from "@/lib/app-version";
import {
  deletionErrorMessage,
  deletionPreviewMessage,
  type DeletionPreview,
} from "@/lib/account-deletion";
import type { Profile } from "@/lib/mappers";
import { tap, error as errorFeedback } from "@/lib/feedback";
import { FONT, colors, radii } from "@/theme/tokens";

/**
 * Real version + build of the running binary. `expoConfig.version` is the
 * marketing version from app.json; the build number comes from the native
 * binary (`Constants.platform.ios.buildNumber` = CFBundleVersion,
 * `Constants.platform.android.versionCode`) because EAS remote versioning
 * stamps it into the native project, not into app.json. Both are null in
 * Expo Go, where the row simply shows the version alone.
 */
const APP_VERSION_LABEL = formatAppVersion({
  version: Constants.expoConfig?.version,
  nativeBuild:
    Platform.OS === "ios"
      ? Constants.platform?.ios?.buildNumber
      : Platform.OS === "android"
        ? Constants.platform?.android?.versionCode
        : null,
  configBuild:
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Platform.OS === "android"
        ? Constants.expoConfig?.android?.versionCode
        : null,
});

/**
 * Long-month keys indexed by `Date#getMonth()`; resolved through `tr` at
 * render so the "with Memika since" line follows the language switch.
 */
const MONTH_LONG_KEYS: readonly TKey[] = [
  "format.monthLongJanuary",
  "format.monthLongFebruary",
  "format.monthLongMarch",
  "format.monthLongApril",
  "format.monthLongMay",
  "format.monthLongJune",
  "format.monthLongJuly",
  "format.monthLongAugust",
  "format.monthLongSeptember",
  "format.monthLongOctober",
  "format.monthLongNovember",
  "format.monthLongDecember",
];

/**
 * Month key + year from a profiles.created_at ISO timestamp; null for a
 * missing or unparsable value so the caller can hide the line instead of
 * inventing a date. Uses the device's local time zone — an account created
 * at 23:30 UTC on the last day of a month shows the month the user
 * actually experienced.
 */
function memberSinceParts(
  createdAt: string | null | undefined,
): { monthKey: TKey; year: number } | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const monthKey = MONTH_LONG_KEYS[date.getMonth()];
  if (!monthKey) return null;
  return { monthKey, year: date.getFullYear() };
}

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const { t: tr } = useT();
  const signOut = useAuthStore((s) => s.signOut);
  const setUserName = useAuthStore((s) => s.setUserName);
  const viewAsUser = useAuthStore((s) => s.viewAsUser);
  const setViewAsUser = useAuthStore((s) => s.setViewAsUser);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState(user?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Live counts for the confirmation sheet — null while loading or when the
  // count query failed (the copy then falls back to a count-free sentence).
  const [deletionPreview, setDeletionPreview] = useState<DeletionPreview | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Real profile (null in demo mode — the hardcoded literals below act as
  // the fallback until pickers/persistence land for every field).
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => {
        if (!cancelled && p) setProfile(p);
      })
      .catch((err) => {
        reportError("settings/profile-load", err);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleNameEndEditing = () => {
    const trimmed = name.trim();
    if (!user || !trimmed || trimmed === user.name) return;
    setUserName(trimmed);
    updateProfile(user.id, { name: trimmed }).catch((err) => {
      reportError("settings/name-save", err);
    });
  };

  const initials = (name || "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const handleSignOut = async () => {
    // Drop any in-progress review first: its fire-and-forget writes are
    // already .catch()-guarded, but a live deck must not outlive the user.
    useReviewStore.getState().reset();
    await signOut();
    router.replace("/(auth)/login");
  };

  const openDeleteConfirm = () => {
    if (!user) return;
    errorFeedback();
    setDeletionPreview(null);
    setConfirmDelete(true);
    const uid = user.id;
    fetchDeletionPreview(uid)
      .then((p) => {
        // Ignore a late result if the user signed out meanwhile.
        if (useAuthStore.getState().user?.id === uid) setDeletionPreview(p);
      })
      .catch((err) => {
        reportError("settings/deletion-preview", err);
      });
  };

  const handleDeleteAccount = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      // 72 ore di grazia (migration 20260830121000): la riga profiles viene
      // marcata, i dati restano; riaccedendo entro il termine l'app propone
      // "Recupera account". La purga definitiva è un job server.
      await requestAccountDeletion();
    } catch (err) {
      reportError("settings/account-deletion", err);
      // Close the sheet BEFORE toasting: the global toast renders below this
      // native Modal and would be invisible on iOS while it stays open.
      setDeleting(false);
      setConfirmDelete(false);
      showToast(deletionErrorMessage(err));
      return;
    }
    // L'account è marcato per l'eliminazione (72h): chiudiamo la sessione
    // locale — mazzo, sign out, login. I dati restano fino alla purga.
    useReviewStore.getState().reset();
    setConfirmDelete(false);
    await signOut();
    setDeleting(false);
    router.replace("/(auth)/login");
    showToast(tr("settings.accountDeletedToast"));
  };

  const openDeletionWebPage = () => openExternal(ACCOUNT_DELETION_URL);

  // Legal pages + support mailto. System browser / mail client; failures
  // (no mail app configured, URL blocked) surface as a toast, never a crash.
  // The mail subject is built here, not at module level, so it follows the
  // language switch.
  const supportMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    tr("settings.supportMailSubject"),
  )}`;
  const openExternal = (url: string) => {
    tap();
    Linking.openURL(url).catch((err) => {
      reportError("settings/open-url", err, { url });
      showToast(
        url.startsWith("mailto:")
          ? tr("settings.noMailAppToast", { email: SUPPORT_EMAIL })
          : tr("settings.openPageError"),
      );
    });
  };

  const backToAdmin = () => {
    tap();
    // Clear the flag first: the admin surface never bounces an admin, but
    // the (app) gate would re-render this tree before the replace lands.
    setViewAsUser(false);
    router.replace("/(admin)/home");
  };

  // "Con Memika da agosto 2026" from profiles.created_at; null in demo mode /
  // before the profile loads → fall back to the email, never to an invented date.
  const memberSince = memberSinceParts(profile?.createdAt);
  const profileSubtitle = memberSince
    ? tr("settings.memberSince", { month: tr(memberSince.monthKey), year: memberSince.year })
    : (user?.email ?? "");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <HeaderHero title={tr("settings.title")} reservedRight={108} />
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 2, right: 14 }}
          >
            <Mascot variant="announce" size={92} withShadow={false} />
          </View>
        </View>

        {/* Profile card */}
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="flex-row items-center rounded-card bg-surface"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <InitialsAvatar
              initials={initials}
              size={44}
              variant={user?.role === "admin" ? "admin" : "user"}
            />
            <View className="flex-1" style={{ minWidth: 0 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                onEndEditing={handleNameEndEditing}
                placeholder={tr("settings.namePlaceholder")}
                placeholderTextColor={colors.placeholder}
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 16.5,
                  color: colors.navy,
                  letterSpacing: -0.15,
                  padding: 0,
                }}
              />
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 13.5,
                  color: colors.midGrey,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {profileSubtitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Schedule — hidden until notifications exist (NOTIFICATIONS_ENABLED). */}
        {NOTIFICATIONS_ENABLED && (
          <>
        {/* Schedule */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.scheduleSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {/* Time values are HH:MM:SS from Postgres — show HH:MM. Rows stay
              non-interactive until real time pickers exist. */}
          <SettingsRow label={tr("settings.morningReview")} value={(profile?.morningReviewAt ?? "08:00").slice(0, 5)} />
          <SettingsRow label={tr("settings.eveningReview")} value={(profile?.eveningReviewAt ?? "21:30").slice(0, 5)} />
        </View>
          </>
        )}

        {/* Limits */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.limitsSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label={tr("settings.dailyLimit")}
            hint={tr("settings.dailyLimitHint")}
            value={profile ? String(profile.dailyInputCap) : "20"}
          />
        </View>

        {NOTIFICATIONS_ENABLED && (
          <>
        {/* Notifications */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.notificationsSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {/* Toggles are uncontrolled — the key remounts them once the real
              profile loads so defaultOn reflects the stored value. */}
          <SettingsToggle
            key={profile ? `calm-${profile.calmMode}` : "calm"}
            label={tr("settings.calmMode")}
            hint={tr("settings.calmModeHint")}
            defaultOn={profile ? profile.calmMode : true}
            onChange={(v) => {
              if (!user) return;
              updateProfile(user.id, { calmMode: v }).catch((err) => {
                reportError("settings/calm-mode-save", err);
              });
            }}
          />
          <SettingsToggle
            key={profile ? `digest-${profile.weeklyDigest}` : "digest"}
            label={tr("settings.weeklyDigest")}
            hint={tr("settings.weeklyDigestHint")}
            defaultOn={profile ? profile.weeklyDigest : false}
            onChange={(v) => {
              if (!user) return;
              updateProfile(user.id, { weeklyDigest: v }).catch((err) => {
                reportError("settings/weekly-digest-save", err);
              });
            }}
          />
        </View>
          </>
        )}

        {/* Aspetto — Default (telefono) / Chiaro / Scuro (2026-09-02). */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.appearanceSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <ThemePicker />
        </View>

        {/* Language — device language by default, forced from here. */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.languageSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <LanguagePicker />
        </View>

        {/* About */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.aboutSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label={tr("settings.trashLabel")}
            hint={tr("settings.trashHint")}
            value={tr("settings.open")}
            onPress={() => {
              tap();
              router.push("/trash" as never);
            }}
          />
          <SettingsRow label={tr("settings.version")} value={APP_VERSION_LABEL} />
          {/* Identità del bundle JS: l'unico modo per un tester (o per noi)
              di distinguere "l'OTA non è arrivata" da "è arrivata e la
              modifica è sottile". updateId è null quando gira il bundle di
              fabbrica o in Expo Go — costante per la vita del processo,
              quindi va bene leggerla a livello di modulo. */}
          <SettingsRow
            label={tr("settings.otaUpdate")}
            hint={tr("settings.otaUpdateHint")}
            value={Updates.updateId ? Updates.updateId.slice(0, 8) : tr("settings.otaEmbedded")}
          />
          {user?.role === "admin" && viewAsUser ? (
            <SettingsRow
              label={tr("settings.backToAdmin")}
              hint={tr("settings.backToAdminHint")}
              value={tr("settings.open")}
              onPress={backToAdmin}
            />
          ) : null}
        </View>

        {/* Legal + support — real pages on GitHub Pages (ioterra360.github.io/memika-legal), mailto for support */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.legalSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label={tr("settings.privacyPolicy")}
            value={tr("settings.open")}
            onPress={() => openExternal(PRIVACY_URL)}
          />
          <SettingsRow
            label={tr("settings.termsOfService")}
            value={tr("settings.open")}
            onPress={() => openExternal(TERMS_URL)}
          />
          <SettingsRow
            label={tr("settings.contactSupport")}
            hint={SUPPORT_EMAIL}
            value={tr("settings.write")}
            onPress={() => openExternal(supportMailto)}
          />
        </View>

        {/* Danger zone — premium: warning header + two icon-led cards */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} color={colors.danger} strokeWidth={2} />
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 11,
                color: colors.danger,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {tr("settings.dangerZone")}
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <DangerCard
            icon={LogOut}
            iconColor={colors.navy}
            iconBg={colors.tagUserBg}
            title={tr("settings.signOut")}
            body={tr("settings.signOutBody")}
            onPress={() => {
              tap();
              handleSignOut();
            }}
          />
          <DangerCard
            icon={Trash2}
            iconColor={colors.danger}
            iconBg={colors.dangerSoft}
            title={tr("settings.deleteAccount")}
            body={tr("settings.deleteAccountBody")}
            danger
            onPress={openDeleteConfirm}
          />
          {/* Web path — Google Play requires a deletion route that works
              without the app installed; the page is published on GitHub Pages. */}
          <Tappable
            onPress={openDeletionWebPage}
            accessibilityRole="link"
            accessibilityLabel={tr("settings.deletionWebRequestA11y")}
            pressedOpacity={0.6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 13,
                lineHeight: 18,
                color: colors.midGrey,
              }}
            >
              {tr("settings.deletionWebRequest")}{" "}
              <Text style={{ fontFamily: FONT.semibold, color: colors.navy }}>
                ioterra360.github.io/memika-legal/account-deletion/
              </Text>
            </Text>
            <ExternalLink size={13} color={colors.midGrey} strokeWidth={2} />
          </Tappable>
        </View>
      </ScrollView>

      {/* Delete confirmation bottom sheet */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
      >
        {/* Backdrop and sheet are SIBLINGS, not nested. React Native's
            Pressable does not honor synthetic e.stopPropagation(), so a
            nested-pressable approach would dismiss the sheet on any tap
            inside it. Here only the backdrop receives taps to close. */}
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr("common.close")}
            onPress={() => {
              if (!deleting) setConfirmDelete(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15,27,51,0.32)",
            }}
          />
          <View
            style={{
              backgroundColor: colors.warmWhite,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingHorizontal: 22,
              paddingTop: 16,
              paddingBottom: 32,
              shadowColor: "#0F1B33",
              shadowOpacity: 0.18,
              shadowOffset: { width: 0, height: -8 },
              shadowRadius: 30,
              elevation: 24,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D9D7D1",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 22,
                color: colors.navy,
                lineHeight: 26,
                letterSpacing: -0.4,
              }}
            >
              {tr("settings.deleteConfirmTitle")}
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 15,
                color: colors.midGrey,
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              {tr("settings.deleteConfirmBody", {
                preview: deletionPreviewMessage(deletionPreview),
              })}
            </Text>
            <View style={{ marginTop: 22, gap: 10 }}>
              {/* request_account_deletion() RPC (SECURITY DEFINER, target =
                  auth.uid()): 72h di grazia, poi la purga server. */}
              <PrimaryButton
                label={deleting ? tr("settings.deleting") : tr("settings.deleteAll")}
                onPress={() => {
                  errorFeedback();
                  void handleDeleteAccount();
                }}
                variant="danger"
                loading={deleting}
              />
              <GhostButton
                label={tr("common.cancel")}
                onPress={() => setConfirmDelete(false)}
                variant="link"
                disabled={deleting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DangerCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  body,
  danger,
  onPress,
}: {
  icon: typeof LogOut;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      pressedOpacity={0.92}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.hairlineStrong,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={iconColor} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 16,
            color: danger ? colors.danger : colors.navy,
            letterSpacing: -0.15,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontFamily: FONT.regular,
            fontSize: 14,
            lineHeight: 20,
            color: colors.midGrey,
          }}
        >
          {body}
        </Text>
      </View>
    </Tappable>
  );
}

/**
 * Tre pillole: Default (telefono) / Chiaro / Scuro. Stesso pattern del
 * LanguagePicker: il confronto è sulla PREFERENZA, non sullo scheme
 * risolto, così "Default" resta accesa anche quando risolve a chiaro.
 */
function ThemePicker() {
  const { t: tr } = useT();
  const preference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const options: ReadonlyArray<{ value: ThemePreference; label: string }> = [
    { value: "system", label: tr("settings.themeSystem") },
    { value: "light", label: tr("settings.themeLight") },
    { value: "dark", label: tr("settings.themeDark") },
  ];
  return (
    <View
      className="rounded-card bg-surface"
      style={{ padding: 12, borderWidth: 1, borderColor: colors.hairline, gap: 10 }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = preference === o.value;
          return (
            <Tappable
              key={o.value}
              onPress={() => void setThemePreference(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              pressedOpacity={0.8}
              containerStyle={{ flexGrow: 1, flexBasis: "30%" }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: on ? colors.accent : colors.warmWhite,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.hairlineStrong,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 13,
                  color: on ? colors.onAccent : colors.navy,
                }}
              >
                {o.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
      <Text style={{ fontFamily: FONT.regular, fontSize: 12.5, color: colors.midGrey }}>
        {tr("settings.themeHint")}
      </Text>
    </View>
  );
}

/**
 * Three pills: follow the phone / Italiano / English. Changes apply at once
 * (every screen reads strings through useT) and persist in AsyncStorage.
 */
function LanguagePicker() {
  const { t: tr } = useT();
  const preference = useLocaleStore((s) => s.preference);
  const setPreference = useLocaleStore((s) => s.setPreference);
  const options: ReadonlyArray<{ value: LocalePreference; label: string }> = [
    { value: "system", label: tr("settings.languageSystem") },
    { value: "it", label: tr("settings.languageIt") },
    { value: "en", label: tr("settings.languageEn") },
    { value: "fr", label: tr("settings.languageFr") },
    { value: "es", label: tr("settings.languageEs") },
  ];
  return (
    <View
      className="rounded-card bg-surface"
      style={{ padding: 12, borderWidth: 1, borderColor: colors.hairline, gap: 10 }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = preference === o.value;
          return (
            <Tappable
              key={o.value}
              onPress={() => void setPreference(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              pressedOpacity={0.8}
              containerStyle={{ flexGrow: 1, flexBasis: "30%" }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: on ? colors.navy : colors.warmWhite,
                borderWidth: 1,
                borderColor: on ? colors.navy : colors.hairlineStrong,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 13,
                  color: on ? colors.warmWhite : colors.navy,
                }}
              >
                {o.label}
              </Text>
            </Tappable>
          );
        })}
      </View>
      <Text style={{ fontFamily: FONT.regular, fontSize: 12.5, color: colors.midGrey }}>
        {tr("settings.languageHint")}
      </Text>
    </View>
  );
}
