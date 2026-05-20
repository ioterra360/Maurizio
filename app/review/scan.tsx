import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors, layerTint } from "@/theme/tokens";

export default function ScanScreen() {
  const ensureSession = useReviewStore((s) => s.ensureSession);
  const cards = useReviewStore((s) => s.cards());
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [revealed, setRevealed] = useState(false);

  // Today calls start(layer, mode) explicitly before navigating here, so
  // this effect is the defensive fallback for unusual entry paths (deep
  // links, app restore on this route, back-gesture refocus). Scan is the
  // documented entry point of the full Scan → Reinforcement → Focus flow,
  // so the fallback opens flow mode — Today's prior start("scan","single")
  // is preserved because ensureSession no-ops once it sees an open or
  // pending session for the same layer.
  useFocusEffect(
    useCallback(() => {
      ensureSession("scan", "flow");
      setRevealed(false);
    }, [ensureSession]),
  );

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  const card = cards[index];

  const handleRemember = () => {
    // If the user already revealed the answer, this card needed a hint —
    // log it as "struggled" so the store/scheduler treats it as a soft
    // forget (Scan "show me" → SM-2 quality 2 per docs/SRS.md). A pure
    // "remembered" tap (no reveal) keeps full quality 4.
    const response = revealed ? "struggled" : "remembered";
    const result = recordAndAdvance(response);
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const handleShowMe = () => setRevealed(true);

  if (!card) return null;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="scan" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
        <FolderPill folder={card.folder} layerKey="scan" />

        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 64,
            color: colors.navy,
            letterSpacing: -2,
            textAlign: "center",
            lineHeight: 70,
            marginTop: 20,
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

        {revealed ? (
          <View
            style={{
              backgroundColor: layerTint.scanReveal,
              paddingHorizontal: 20,
              paddingVertical: 18,
              marginTop: 36,
              alignSelf: "stretch",
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 16,
                color: colors.navy,
                lineHeight: 22,
                letterSpacing: -0.1,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : null}
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
