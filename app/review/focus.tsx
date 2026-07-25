import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { MascotLoader } from "@/components/MascotLoader";
import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { RecallButton } from "@/components/RecallButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useReviewStore } from "@/lib/review-store";
import { success, error } from "@/lib/feedback";
import { FONT, colors } from "@/theme/tokens";

export default function FocusScreen() {
  const ensureSession = useReviewStore((s) => s.ensureSession);
  // s.cards() in the selector loops zustand v5 on folder-scoped decks —
  // see the note in review/scan.tsx.
  const layer = useReviewStore((s) => s.layer);
  const folderKind = useReviewStore((s) => s.folderKind);
  const deck = useReviewStore((s) => s.deck);
  const deckLoading = useReviewStore((s) => s.deckLoading);
  const mode = useReviewStore((s) => s.mode);
  const getCards = useReviewStore((s) => s.cards);
  const cards = useMemo(() => getCards(), [getCards, layer, folderKind, deck]);
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [revealed, setRevealed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // No-op when arriving from a flow handoff; opens a single-layer
      // session when Today routed us here directly.
      ensureSession("focus", "single");
      setRevealed(false);
    }, [ensureSession]),
  );

  // Hide the answer again whenever the deck advances to the next card.
  useEffect(() => {
    setRevealed(false);
  }, [index]);

  // Livello vuoto dentro un flusso: chiudi direttamente sul recap.
  useEffect(() => {
    if (deckLoading || cards.length > 0 || mode !== "flow") return;
    router.replace("/review/complete");
  }, [deckLoading, cards.length, mode]);

  const card = cards[index];

  if (deckLoading || (mode === "flow" && cards.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label="Preparo il ripasso…" />
        </View>
      </SafeAreaView>
    );
  }

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
            Nessun ricordo per il ripasso profondo, per ora.
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 24 }}>
            <PrimaryButton label="Torna indietro" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const advance = (response: "remembered" | "struggled" | "forgot") => {
    // Mirror scan/reinforcement: success on a clean recall, error otherwise
    // (struggled is a soft forget per the SM-2 downgrade in review-store).
    if (response === "remembered") success();
    else error();
    const result = recordAndAdvance(response);
    if (result === "done") router.replace("/review/complete");
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="focus" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: 28 }}>
        <View style={{ alignItems: "center" }}>
          <FolderPill folder={card.folder} layerKey="focus" />
        </View>

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontFamily: FONT.bold,
            fontSize: card.front.length > 10 ? 44 : 80,
            color: colors.navy,
            letterSpacing: -2.2,
            textAlign: "center",
            lineHeight: card.front.length > 10 ? 52 : 88,
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
              textAlign: "center",
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {revealed ? (
          <View
            className="rounded-card"
            style={{
              backgroundColor: colors.divider,
              paddingHorizontal: 18,
              paddingVertical: 16,
              marginTop: 36,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 17,
                color: colors.navy,
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
                  color: colors.navySoft,
                  lineHeight: 20,
                }}
              >
                {card.example}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Recall buttons appear only after the answer is revealed — Focus is
          active recall, so the answer stays hidden until the user commits. */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 10 }}>
        {revealed ? (
          <>
            <RecallButton variant="forgot" onPress={() => advance("forgot")} />
            <RecallButton variant="struggled" onPress={() => advance("struggled")} />
            <RecallButton variant="remembered" onPress={() => advance("remembered")} />
          </>
        ) : (
          <PrimaryButton label="Mostra risposta" onPress={() => setRevealed(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}
