import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { useReviewStore } from "@/lib/review-store";
import { success, error, tap } from "@/lib/feedback";
import { FONT, colors, statusTint } from "@/theme/tokens";

type Stage = "pre" | "hint" | "answer";

export default function ReinforcementScreen() {
  const ensureSession = useReviewStore((s) => s.ensureSession);
  const cards = useReviewStore((s) => s.cards());
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [stage, setStage] = useState<Stage>("pre");

  useFocusEffect(
    useCallback(() => {
      // No-op when arriving from a flow handoff (sessionId is already open);
      // opens a single-layer session when Today routed us here directly.
      ensureSession("reinforcement", "single");
      setStage("pre");
    }, [ensureSession]),
  );

  useEffect(() => {
    setStage("pre");
  }, [index]);

  const card = cards[index];
  if (!card) return null;

  const advance = (response: "remembered" | "struggled") => {
    if (response === "remembered") success();
    else error();
    const result = recordAndAdvance(response);
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const reveal = (next: Stage) => {
    tap();
    setStage(next);
  };

  // Authored mnemonic hint when the card has one; otherwise derive the
  // first sense of a multi-sense back (ellipsis baked in — only a prefix is
  // a truncation). A single-sense back yields no hint at all, so the hint
  // can never leak the full answer.
  const senses = card.back.split(" · ");
  const hint = card.hint ?? (senses.length > 1 ? `${senses[0]}…` : null);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="reinforcement" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 40 }}>
        <FolderPill folder={card.folder} layerKey="reinforcement" />

        <Text
          adjustsFontSizeToFit
          numberOfLines={2}
          style={{
            fontFamily: FONT.bold,
            fontSize: card.front.length > 10 ? 48 : 72,
            color: colors.navy,
            letterSpacing: -2.2,
            textAlign: "center",
            lineHeight: card.front.length > 10 ? 54 : 80,
            marginTop: 24,
            paddingHorizontal: 8,
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

        {/* Hint card — sparkle + single-line hint, dashed violet border */}
        {stage === "hint" ? (
          <View
            className="flex-row items-center self-stretch"
            style={{
              marginTop: 32,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.reinforcement,
              borderStyle: "dashed",
              gap: 10,
            }}
          >
            <Sparkles size={18} color={colors.reinforcement} strokeWidth={1.8} />
            <Text
              style={{
                flex: 1,
                fontFamily: FONT.medium,
                fontSize: 15,
                color: colors.navy,
                lineHeight: 21,
                letterSpacing: -0.07,
              }}
            >
              {hint}
            </Text>
          </View>
        ) : null}

        {/* Answer panel */}
        {stage === "answer" ? (
          <View
            className="self-stretch rounded-card bg-surface"
            style={{
              marginTop: 32,
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 18,
                color: colors.navy,
                lineHeight: 24,
                letterSpacing: -0.2,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 10 }}>
        {stage === "pre" ? (
          <>
            {/* No hint affordance when the card has nothing safe to show. */}
            {hint != null ? (
              <Pressable
                onPress={() => reveal("hint")}
                accessibilityRole="button"
                accessibilityLabel="Dammi un indizio"
                className="items-center justify-center rounded-cta"
                style={({ pressed }) => ({
                  height: 56,
                  borderWidth: 1.5,
                  borderColor: colors.hairlineStrong,
                  backgroundColor: colors.warmWhite,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: colors.navy }}>
                  Dammi un indizio
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => reveal("answer")}
              accessibilityRole="button"
              accessibilityLabel="Mostra risposta"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 60,
                backgroundColor: colors.reinforcement,
                borderWidth: 0,
                opacity: pressed ? 0.88 : 1,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 20,
                elevation: 5,
              })}
            >
              <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
                Mostra risposta
              </Text>
            </Pressable>
          </>
        ) : null}

        {stage === "hint" ? (
          <Pressable
            onPress={() => reveal("answer")}
            accessibilityRole="button"
            accessibilityLabel="Mostra risposta"
            className="items-center justify-center rounded-cta"
            style={({ pressed }) => ({
              height: 60,
              backgroundColor: colors.reinforcement,
              borderWidth: 0,
              opacity: pressed ? 0.88 : 1,
              shadowColor: colors.reinforcement,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 20,
              elevation: 5,
            })}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
              Mostra risposta
            </Text>
          </Pressable>
        ) : null}

        {stage === "answer" ? (
          <>
            <Pressable
              onPress={() => advance("struggled")}
              accessibilityRole="button"
              accessibilityLabel="Ripassa di nuovo"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 56,
                borderWidth: 1.5,
                borderColor: colors.fading,
                backgroundColor: colors.warmWhite,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: statusTint.fading.text }}>
                Ripassa di nuovo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => advance("remembered")}
              accessibilityRole="button"
              accessibilityLabel="Continua"
              className="items-center justify-center rounded-cta"
              style={({ pressed }) => ({
                height: 60,
                backgroundColor: colors.reinforcement,
                borderWidth: 0,
                opacity: pressed ? 0.88 : 1,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 20,
                elevation: 5,
              })}
            >
              <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
                Continua
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
