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
import { LogOut, Trash2, AlertTriangle, ExternalLink } from "lucide-react-native";

import { HeaderHero } from "@/components/HeaderHero";
import { InitialsAvatar } from "@/components/FolderTile";
import { SectionLabel } from "@/components/SectionLabel";
import { useLocaleStore, useT, type LocalePreference } from "@/lib/i18n";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useReviewStore } from "@/lib/review-store";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { deleteOwnAccount, fetchDeletionPreview, fetchProfile, updateProfile } from "@/lib/api";
import {
  ACCOUNT_DELETION_URL,
  PREMIUM_ENABLED,
  PRIVACY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from "@/lib/constants";
import { formatAppVersion, memberSinceLabel } from "@/lib/app-version";
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

const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Supporto Memika")}`;

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
      await deleteOwnAccount();
    } catch (err) {
      reportError("settings/account-deletion", err);
      // Close the sheet BEFORE toasting: the global toast renders below this
      // native Modal and would be invisible on iOS while it stays open.
      setDeleting(false);
      setConfirmDelete(false);
      showToast(deletionErrorMessage(err));
      return;
    }
    // Server side the account is gone (sessions cascade from auth.users).
    // Clear the local session: reset the review deck, sign out, go to login.
    useReviewStore.getState().reset();
    setConfirmDelete(false);
    await signOut();
    setDeleting(false);
    router.replace("/(auth)/login");
    showToast("Account eliminato");
  };

  const openDeletionWebPage = () => openExternal(ACCOUNT_DELETION_URL);

  // Legal pages + support mailto. System browser / mail client; failures
  // (no mail app configured, URL blocked) surface as a toast, never a crash.
  const openExternal = (url: string) => {
    tap();
    Linking.openURL(url).catch((err) => {
      reportError("settings/open-url", err, { url });
      showToast(
        url.startsWith("mailto:")
          ? `Nessuna app di posta disponibile. Scrivi a ${SUPPORT_EMAIL}.`
          : "Impossibile aprire la pagina. Riprova.",
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

  // "da agosto 2026" from profiles.created_at; null in demo mode / before
  // the profile loads → fall back to the email, never to an invented date.
  const memberSince = memberSinceLabel(profile?.createdAt);
  const profileSubtitle = memberSince ? `Con Memika ${memberSince}` : (user?.email ?? "");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <HeaderHero title="Impostazioni" reservedRight={108} />
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
                placeholder="Il tuo nome"
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

        {/* Schedule */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Orari</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {/* Time values are HH:MM:SS from Postgres — show HH:MM. Rows stay
              non-interactive until real time pickers exist. */}
          <SettingsRow label="Ripasso mattutino" value={(profile?.morningReviewAt ?? "08:00").slice(0, 5)} />
          <SettingsRow label="Ripasso serale"    value={(profile?.eveningReviewAt ?? "21:30").slice(0, 5)} />
        </View>

        {/* Limits */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Limiti</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label="Limite giornaliero"
            hint="Numero massimo di nuovi ricordi da aggiungere al giorno."
            value={profile ? String(profile.dailyInputCap) : "20"}
          />
        </View>

        {/* Notifications */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Notifiche</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {/* Toggles are uncontrolled — the key remounts them once the real
              profile loads so defaultOn reflects the stored value. */}
          <SettingsToggle
            key={profile ? `calm-${profile.calmMode}` : "calm"}
            label="Modalità calma"
            hint="Niente contatori rossi né promemoria insistenti. Le notifiche di ripasso arriveranno in un prossimo aggiornamento: la preferenza viene salvata già ora."
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
            label="Riepilogo settimanale"
            hint="Un riassunto settimanale di cosa si è consolidato e cosa sta sfumando. Non è ancora attivo: arriverà in un prossimo aggiornamento."
            defaultOn={profile ? profile.weeklyDigest : false}
            onChange={(v) => {
              if (!user) return;
              updateProfile(user.id, { weeklyDigest: v }).catch((err) => {
                reportError("settings/weekly-digest-save", err);
              });
            }}
          />
        </View>

        {/* Language — device language by default, forced from here. */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.languageSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <LanguagePicker />
        </View>

        {/* Premium — hidden until the RevenueCat paywall replaces the old
            external-checkout screen (see PREMIUM_ENABLED). */}
        {PREMIUM_ENABLED && (
          <>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
              <SectionLabel>Abbonamento</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <SettingsRow
                label="Memika Premium"
                hint="Sblocca ricordi illimitati e insight personalizzati."
                value="Scopri"
                onPress={() => router.push("/(app)/subscribe" as never)}
              />
            </View>
          </>
        )}

        {/* About */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Informazioni</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow label="Versione" value={APP_VERSION_LABEL} />
          {user?.role === "admin" && viewAsUser ? (
            <SettingsRow
              label="Torna al pannello admin"
              hint="Stai usando l'app come utente con il tuo account admin."
              value="Apri"
              onPress={backToAdmin}
            />
          ) : null}
        </View>

        {/* Legal + support — real pages on GitHub Pages (ioterra360.github.io/memika-legal), mailto for support */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Privacy e termini</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label="Informativa privacy"
            value="Apri"
            onPress={() => openExternal(PRIVACY_URL)}
          />
          <SettingsRow
            label="Termini di servizio"
            value="Apri"
            onPress={() => openExternal(TERMS_URL)}
          />
          <SettingsRow
            label="Contatta il supporto"
            hint={SUPPORT_EMAIL}
            value="Scrivi"
            onPress={() => openExternal(SUPPORT_MAILTO)}
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
              Zona pericolosa
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <DangerCard
            icon={LogOut}
            iconColor={colors.navy}
            iconBg={colors.tagUserBg}
            title="Esci dall'account"
            body="Servirà email e password per rientrare."
            onPress={() => {
              tap();
              handleSignOut();
            }}
          />
          <DangerCard
            icon={Trash2}
            iconColor={colors.danger}
            iconBg={colors.dangerSoft}
            title="Elimina account"
            body="Cancella tutti i ricordi, le cartelle e la cronologia. Non recuperabile."
            danger
            onPress={openDeleteConfirm}
          />
          {/* Web path — Google Play requires a deletion route that works
              without the app installed; the page is published on GitHub Pages. */}
          <Tappable
            onPress={openDeletionWebPage}
            accessibilityRole="link"
            accessibilityLabel="Richiesta di eliminazione via web"
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
              Richiesta via web:{" "}
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
            accessibilityLabel="Chiudi"
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
              Eliminare il tuo account Memika?
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
              {deletionPreviewMessage(deletionPreview)} Verrai disconnesso da ogni
              dispositivo. Non si può annullare.
            </Text>
            <View style={{ marginTop: 22, gap: 10 }}>
              {/* Real deletion: delete_own_account() RPC (SECURITY DEFINER,
                  target = auth.uid()), then local sign-out → login. */}
              <PrimaryButton
                label={deleting ? "Elimino…" : "Sì, elimina tutto"}
                onPress={() => {
                  errorFeedback();
                  void handleDeleteAccount();
                }}
                variant="danger"
                loading={deleting}
              />
              <GhostButton
                label="Annulla"
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
  ];
  return (
    <View
      className="rounded-card bg-surface"
      style={{ padding: 12, borderWidth: 1, borderColor: colors.hairline, gap: 10 }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
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
              containerStyle={{ flex: 1 }}
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
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
