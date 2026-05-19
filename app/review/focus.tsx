import { useCallback } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { ReviewHeader } from "@/components/ReviewHeader";
import { RecallButton } from "@/components/RecallButton";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors } from "@/theme/tokens";

export default function FocusScreen() {
  const setLayer = useReviewStore((s) => s.setLayer);
  const cards = useReviewStore((s) => s.cards());
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);

  useFocusEffect(
    useCallback(() => {
      setLayer("focus");
    }, [setLayer]),
  );

  const card = cards[index];
  if (!card) return null;

  const advance = (response: "remembered" | "struggled" | "forgot") => {
    const result = recordAndAdvance(response);
    if (result === "done") router.replace("/review/complete");
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="focus" index={index} total={cards.length} />

      {/* Term and meaning */}
      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 36 }}>
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 56,
            color: colors.navy,
            letterSpacing: -2,
            textAlign: "center",
            lineHeight: 60,
          }}
        >
          {card.front}
        </Text>
        {card.reading ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 16,
              color: colors.midGrey,
              marginTop: 12,
              letterSpacing: 0.2,
              textAlign: "center",
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        <View
          className="rounded-card"
          style={{
            backgroundColor: colors.divider,
            paddingHorizontal: 20,
            paddingVertical: 18,
            marginTop: 36,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 11,
              color: colors.midGrey,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            From {card.folder}
          </Text>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 17,
              color: colors.navy,
              marginTop: 6,
              lineHeight: 24,
              letterSpacing: -0.15,
            }}
          >
            {card.back}
          </Text>
          {card.example ? (
            <Text
              style={{
                marginTop: 12,
                fontFamily: FONT.regular,
                fontSize: 14,
                fontStyle: "italic",
                color: "#243C6B",
                lineHeight: 20,
              }}
            >
              {card.example}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Recall buttons */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 10 }}>
        <RecallButton variant="forgot" onPress={() => advance("forgot")} />
        <RecallButton variant="struggled" onPress={() => advance("struggled")} />
        <RecallButton variant="remembered" onPress={() => advance("remembered")} />
      </View>
    </SafeAreaView>
  );
}
