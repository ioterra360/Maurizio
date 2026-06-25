import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { useReviewStore } from "@/lib/review-store";
import { success, tap } from "@/lib/feedback";
import { FONT, colors, layerTint, radii } from "@/theme/tokens";

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
    // Neutral cue after a reveal — the silent "struggled" downgrade is
    // correct per docs/SRS.md, but a positive-labelled tap must never get
    // the error buzz.
    if (revealed) tap();
    else success();
    const result = recordAndAdvance(response);
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const handleShowMe = () => {
    tap();
    setRevealed(true);
  };

  // Empty deck — e.g. a folder-scoped session whose folder has no due
  // cards, or a stale deep link. Offer a way back instead of a blank screen.
  if (!card) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 18,
              color: colors.navy,
              lineHeight: 26,
              textAlign: "center",
            }}
          >
            Nessun ricordo da ripassare qui.
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
            style={({ pressed }) => ({
              marginTop: 24,
              height: 48,
              paddingHorizontal: 28,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.navy,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: colors.warmWhite }}>
              Torna indietro
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="scan" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 48 }}>
        <FolderPill folder={card.folder} layerKey="scan" />

        <Text
          adjustsFontSizeToFit
          numberOfLines={2}
          style={{
            fontFamily: FONT.bold,
            fontSize: card.front.length > 10 ? 56 : 84,
            color: colors.navy,
            letterSpacing: -2.4,
            textAlign: "center",
            lineHeight: card.front.length > 10 ? 64 : 92,
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
              fontSize: 21,
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
                fontSize: 19,
                color: colors.navy,
                lineHeight: 26,
                letterSpacing: -0.1,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 12 }}>
        <Pressable
          onPress={handleShowMe}
          disabled={revealed}
          accessibilityRole="button"
          accessibilityLabel="Mostrami il significato"
          className="items-center justify-center rounded-cta"
          style={({ pressed }) => ({
            height: 56,
            borderWidth: 1.5,
            borderColor: revealed ? colors.divider : colors.scan,
            backgroundColor: colors.warmWhite,
            opacity: revealed ? 0.55 : pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 18,
              color: revealed ? colors.midGrey : colors.scan,
              letterSpacing: -0.1,
            }}
          >
            Mostrami
          </Text>
        </Pressable>
        <Pressable
          onPress={handleRemember}
          accessibilityRole="button"
          accessibilityLabel="Lo ricordo"
          className="items-center justify-center rounded-cta"
          style={({ pressed }) => ({
            height: 60,
            backgroundColor: colors.scan,
            borderWidth: 0,
            opacity: pressed ? 0.88 : 1,
            shadowColor: colors.scan,
            shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 20,
            elevation: 5,
          })}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 19,
              color: colors.warmWhite,
              letterSpacing: -0.16,
            }}
          >
            Lo ricordo
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
