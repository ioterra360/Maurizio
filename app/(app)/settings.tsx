import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LogOut, Trash2, AlertTriangle } from "lucide-react-native";

import { HeaderHero } from "@/components/HeaderHero";
import { InitialsAvatar } from "@/components/FolderTile";
import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { fetchProfile, updateProfile } from "@/lib/api";
import { PREMIUM_ENABLED } from "@/lib/constants";
import type { Profile } from "@/lib/mappers";
import { tap, error as errorFeedback } from "@/lib/feedback";
import { FONT, colors, radii } from "@/theme/tokens";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setUserName = useAuthStore((s) => s.setUserName);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState(user?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
        if (__DEV__) console.warn("[Memika] settings profile load failed", err);
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
      if (__DEV__) console.warn("[Memika] name save failed", err);
    });
  };

  const initials = (name || "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

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
              >
                Studente quotidiano · da marzo 2026
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
            hint="Niente contatori rossi né notifiche insistenti: arriva solo il promemoria del ripasso al mattino."
            defaultOn={profile ? profile.calmMode : true}
            onChange={(v) => {
              if (!user) return;
              updateProfile(user.id, { calmMode: v }).catch((err) => {
                if (__DEV__) console.warn("[Memika] calm mode save failed", err);
              });
            }}
          />
          <SettingsToggle
            key={profile ? `digest-${profile.weeklyDigest}` : "digest"}
            label="Riepilogo settimanale"
            hint="La domenica un riassunto di ciò che si è consolidato, cosa sta sfumando, dove concentrarti."
            defaultOn={profile ? profile.weeklyDigest : false}
            onChange={(v) => {
              if (!user) return;
              updateProfile(user.id, { weeklyDigest: v }).catch((err) => {
                if (__DEV__) console.warn("[Memika] weekly digest save failed", err);
              });
            }}
          />
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
          <SettingsRow label="Versione" value="0.1.0" />
          <SettingsRow label="Privacy"  value="Locale, sempre" />
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
            onPress={() => {
              errorFeedback();
              setConfirmDelete(true);
            }}
          />
        </View>
      </ScrollView>

      {/* Delete confirmation bottom sheet */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmDelete(false)}
      >
        {/* Backdrop and sheet are SIBLINGS, not nested. React Native's
            Pressable does not honor synthetic e.stopPropagation(), so a
            nested-pressable approach would dismiss the sheet on any tap
            inside it. Here only the backdrop receives taps to close. */}
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setConfirmDelete(false)}
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
              779 ricordi in 4 cartelle saranno eliminati per sempre.
              Verrai disconnesso da ogni dispositivo.
            </Text>
            <View style={{ marginTop: 22, gap: 10 }}>
              {/* Account deletion is not wired yet (needs an Edge Function —
                  GDPR work requiring human sign-off). The sheet must close in
                  the same press: the global toast renders below this native
                  Modal and would be invisible on iOS while it stays open. */}
              <PrimaryButton
                label="Sì, elimina tutto"
                onPress={() => {
                  errorFeedback();
                  setConfirmDelete(false);
                  showToast("L'eliminazione dell'account non è ancora disponibile");
                }}
                variant="danger"
              />
              <GhostButton
                label="Annulla"
                onPress={() => setConfirmDelete(false)}
                variant="link"
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
