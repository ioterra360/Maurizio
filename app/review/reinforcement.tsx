import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { ReviewHeader } from "@/components/ReviewHeader";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors } from "@/theme/tokens";

type Stage = "pre" | "hint" | "answer";

export default function ReinforcementScreen() {
  const setLayer = useReviewStore((s) => s.setLayer);
  const cards = useReviewStore((s) => s.cards());
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [stage, setStage] = useState<Stage>("pre");

  useFocusEffect(
    useCallback(() => {
      setLayer("reinforcement");
      setStage("pre");
    }, [setLayer]),
  );

  useEffect(() => {
    setStage("pre");
  }, [index]);

  const card = cards[index];
  if (!card) return null;

  const advance = (response: "remembered" | "struggled") => {
    const result = recordAndAdvance(response);
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const hint = card.back.split(" · ")[0] ?? card.back.slice(0, 18);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="reinforcement" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
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
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {stage === "hint" ? (
          <View
            style={{
              marginTop: 32,
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.reinforcement,
              borderStyle: "dashed",
              alignSelf: "stretch",
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 11,
                color: colors.reinforcement,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Hint
            </Text>
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 15,
                color: colors.navy,
                marginTop: 4,
                lineHeight: 21,
              }}
            >
              {hint}…
            </Text>
          </View>
        ) : null}

        {stage === "answer" ? (
          <View
            style={{
              marginTop: 32,
              padding: 18,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.hairline,
              alignSelf: "stretch",
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 11,
                color: colors.midGrey,
                letterSpacing: 1.1,
                textTransform: "uppercase",
              }}
            >
              From {card.folder}
            </Text>
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 18,
                color: colors.navy,
                marginTop: 6,
                lineHeight: 24,
                letterSpacing: -0.2,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 10 }}>
        {stage === "pre" ? (
          <>
            <Pressable
              onPress={() => setStage("hint")}
              accessibilityRole="button"
              accessibilityLabel="Need a hint"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 50,
                borderWidth: 1.5,
                borderColor: colors.hairlineStrong,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy }}>
                Need a hint
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStage("answer")}
              accessibilityRole="button"
              accessibilityLabel="Show answer"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 54,
                backgroundColor: colors.reinforcement,
                opacity: pressed ? 0.88 : 1,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.45,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 18,
                elevation: 4,
              })}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: "#fff" }}>
                Show answer
              </Text>
            </Pressable>
          </>
        ) : null}

        {stage === "hint" ? (
          <Pressable
            onPress={() => setStage("answer")}
            accessibilityRole="button"
            accessibilityLabel="Show answer"
            className="items-center justify-center rounded-cta"
            style={({ pressed }) => ({
              height: 54,
              backgroundColor: colors.reinforcement,
              opacity: pressed ? 0.88 : 1,
              shadowColor: colors.reinforcement,
              shadowOpacity: 0.45,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 18,
              elevation: 4,
            })}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: "#fff" }}>
              Show answer
            </Text>
          </Pressable>
        ) : null}

        {stage === "answer" ? (
          <>
            <Pressable
              onPress={() => advance("struggled")}
              accessibilityRole="button"
              accessibilityLabel="Review this again"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 50,
                borderWidth: 1.5,
                borderColor: colors.fading,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.fading }}>
                Review this again
              </Text>
            </Pressable>
            <Pressable
              onPress={() => advance("remembered")}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 54,
                backgroundColor: colors.reinforcement,
                opacity: pressed ? 0.88 : 1,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.45,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 18,
                elevation: 4,
              })}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: "#fff" }}>
                Continue
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
