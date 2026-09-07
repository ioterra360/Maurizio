import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { markAddOpenedIntentionally } from "@/lib/add-gate";
import { useT } from "@/lib/i18n";
import { useReviewStore } from "@/lib/review-store";
import { useUIStore } from "@/lib/ui-store";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  /** La frase del livello ("Nessun ricordo da ripassare qui."). */
  title: string;
};

/**
 * Il mazzo e' vuoto: una sessione di cartella senza carte in coda, o un
 * link vecchio. Invece di un vicolo cieco (Angelo, 8/9/2026): "Hai del
 * tempo libero? Aggiungi una nuova nozione alla cartella o esercitati con
 * quelle esistenti", con i due bottoni. L'esercitazione ripassa TUTTE le
 * parole della cartella senza toccare il piano (review-store, practice).
 * Senza una cartella (sessione globale) resta solo il ritorno.
 */
export function EmptyDeck({ title }: Props) {
  const { t } = useT();
  const colors = useColors();
  const folderId = useReviewStore((s) => s.folderId);
  const start = useReviewStore((s) => s.start);
  const showToast = useUIStore((s) => s.showToast);

  const practice = () => {
    if (!folderId) return;
    start("focus", "single", { folderId, practice: true, budgetCap: 28 });
    showToast(t("review.practiceToast"));
    // replace: la schermata vuota non deve restare sotto l'esercitazione.
    router.replace("/review/focus");
  };

  const add = () => {
    if (!folderId) return;
    markAddOpenedIntentionally();
    router.replace({ pathname: "/add", params: { folderId } } as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top", "bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <Mascot variant="idea" size={96} withShadow={false} />
        <Text
          style={{
            marginTop: 18,
            fontFamily: FONT.semibold,
            fontSize: 17,
            lineHeight: 24,
            color: colors.midGrey,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        {folderId ? (
          <>
            <Text
              style={{
                marginTop: 26,
                fontFamily: FONT.bold,
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: -0.4,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {t("review.freeTimeTitle")}
            </Text>
            <Text
              style={{
                marginTop: 10,
                fontFamily: FONT.regular,
                fontSize: 15,
                lineHeight: 23,
                color: colors.midGrey,
                textAlign: "center",
                maxWidth: 320,
              }}
            >
              {t("review.freeTimeBody")}
            </Text>
            <View style={{ alignSelf: "stretch", marginTop: 28, gap: 16 }}>
              <PrimaryButton label={t("review.freeTimeAdd")} onPress={add} />
              <PrimaryButton label={t("review.freeTimePractice")} variant="tonal" onPress={practice} />
            </View>
          </>
        ) : null}
        <View style={{ marginTop: 30 }}>
          <GhostButton variant="link" label={t("common.back")} onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
