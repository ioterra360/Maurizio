import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { ReviewHeader } from "@/components/ReviewHeader";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors } from "@/theme/tokens";

export default function ScanScreen() {
  const start = useReviewStore((s) => s.start);
  const cards = useReviewStore((s) => s.cards());
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [revealed, setRevealed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      start("scan", "flow");
      setRevealed(false);
    }, [start]),
  );

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  const card = cards[index];

  const handleRemember = () => {
    const result = recordAndAdvance("remembered");
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const handleShowMe = () => {
    setRevealed(true);
  };

  if (!card) return null;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="scan" index={index} total={cards.length} />

      {/* Term */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 64,
            color: colors.navy,
            letterSpacing: -2,
            textAlign: "center",
            lineHeight: 70,
          }}
        >
          {card.front}
        </Text>
        {card.reading ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 17,
              color: colors.midGrey,
              marginTop: 14,
              letterSpacing: 0.2,
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {/* Reveal panel */}
        {revealed ? (
          <View
            className="rounded-card"
            style={{
              backgroundColor: colors.divider,
              paddingHorizontal: 20,
              paddingVertical: 18,
              marginTop: 36,
              alignSelf: "stretch",
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
                fontFamily: FONT.medium,
                fontSize: 16,
                color: colors.navy,
                marginTop: 6,
                lineHeight: 22,
                letterSpacing: -0.1,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13,
              color: colors.midGrey,
              marginTop: 36,
              textAlign: "center",
            }}
          >
            From {card.folder}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 10 }}>
        <Pressable
          onPress={handleShowMe}
          accessibilityRole="button"
          accessibilityLabel="Show me the meaning"
          className="items-center justify-center rounded-cta"
          style={({ pressed }) => ({
            height: 50,
            borderWidth: 1.5,
            borderColor: colors.scan,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 15,
              color: colors.scan,
              letterSpacing: -0.1,
            }}
          >
            Show me
          </Text>
        </Pressable>
        <Pressable
          onPress={handleRemember}
          accessibilityRole="button"
          accessibilityLabel="I remember this"
          className="items-center justify-center rounded-cta"
          style={({ pressed }) => ({
            height: 54,
            backgroundColor: colors.scan,
            opacity: pressed ? 0.88 : 1,
            shadowColor: colors.scan,
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 6 },
            shadowRadius: 18,
            elevation: 4,
          })}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 16,
              color: "#fff",
              letterSpacing: -0.16,
            }}
          >
            Remember
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
