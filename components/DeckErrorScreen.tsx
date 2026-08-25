import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { ErrorCard } from "@/components/ErrorCard";
import { Tappable } from "@/components/Tappable";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  /** Reload the current layer's deck (useReviewStore().retryDeckLoad). */
  onRetry: () => void;
  /** Where "Torna indietro" goes when there is no history (deep link). */
  fallbackHref?: string;
};

/**
 * Full-screen state for a failed deck load on Scan / Reinforcement / Focus.
 * Replaces the old behaviour where a network failure produced an empty
 * deck, which the flow logic read as "layer finished" and jumped to
 * Complete with 0 cards. The user can retry in place or leave.
 */
export function DeckErrorScreen({ onRetry, fallbackHref = "/(app)/today" }: Props) {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref as never);
  };
  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 18 }}>
        <ErrorCard
          title="Non siamo riusciti a caricare i ricordi da ripassare."
          hint="Nessuna risposta è stata registrata. Controlla la connessione e riprova."
          onRetry={onRetry}
          retryAccessibilityLabel="Riprova a caricare il ripasso"
        />
        <Tappable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Torna indietro"
          containerStyle={{ alignSelf: "center" }}
          style={{ paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.midGrey }}>
            Torna indietro
          </Text>
        </Tappable>
      </View>
    </SafeAreaView>
  );
}
