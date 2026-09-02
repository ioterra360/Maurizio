import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { cancelAccountDeletion, fetchDeletionRequestedAt } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report-error";
import { ACCOUNT_DELETION_GRACE_HOURS, trashHoursLeft } from "@/lib/trash";
import { useUIStore } from "@/lib/ui-store";
import { FONT, useColors } from "@/theme/tokens";

/**
 * Recupera account — mostrata quando un utente con eliminazione richiesta
 * (profiles.deletion_requested_at) riaccede entro le 72 ore di grazia
 * (migration 20260830121000). Un tocco su "Recupera account" annulla la
 * richiesta; "Esci" lascia tutto com'è (la purga server farà il resto).
 * Il redirect qui parte dal layout (app) — vedi app/(app)/_layout.tsx.
 */
export default function RecoverAccountScreen() {
  const colors = useColors();
  const { t, tp } = useT();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const showToast = useUIStore((s) => s.showToast);

  // null = ancora in verifica; poi l'orario della richiesta (o assenza).
  const [requestedAt, setRequestedAt] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      const ts = await fetchDeletionRequestedAt(user.id);
      if (!ts) {
        // Niente da recuperare (già annullata altrove): dentro l'app.
        router.replace("/(app)/today");
        return;
      }
      setRequestedAt(ts);
    } catch (e) {
      reportError("recover-account/check", e);
      // Meglio l'app di un vicolo cieco: il gate ricontrollerà.
      router.replace("/(app)/today");
    }
  }, [user]);

  useEffect(() => {
    void check();
  }, [check]);

  const recover = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelAccountDeletion();
      showToast(t("recover.recovered"));
      router.replace("/(app)/today");
    } catch (e) {
      reportError("recover-account/cancel", e);
      showToast(t("recover.failed"));
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      router.replace("/(auth)/login");
    }
  };

  const hoursLeft = requestedAt
    ? trashHoursLeft(requestedAt, new Date(), ACCOUNT_DELETION_GRACE_HOURS)
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top", "bottom"]}>
      {requestedAt === undefined ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("recover.checking")} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 28,
            paddingVertical: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center" }}>
            <Mascot variant="investigate" size={128} withShadow={false} />
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: FONT.bold,
                fontSize: 26,
                color: colors.navy,
                letterSpacing: -0.6,
                textAlign: "center",
                marginTop: 18,
              }}
            >
              {t("recover.title")}
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 15,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {hoursLeft > 0
                ? t("recover.body", { hours: tp("recover.hours", hoursLeft) })
                : t("recover.bodyExpired")}
            </Text>
          </View>
          <View style={{ marginTop: 30, gap: 10 }}>
            {hoursLeft > 0 ? (
              <PrimaryButton label={t("recover.cta")} onPress={() => void recover()} loading={busy} />
            ) : null}
            <GhostButton
              label={t("settings.signOut")}
              onPress={() => void leave()}
              variant="link"
              disabled={busy}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
