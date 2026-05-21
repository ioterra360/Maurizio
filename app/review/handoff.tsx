import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LayerCard } from "@/components/LayerCard";
import { useReviewStore } from "@/lib/review-store";
import { success } from "@/lib/feedback";
import { FONT, colors, layer as layerTokens, type LayerKey } from "@/theme/tokens";

export default function ReviewHandoffScreen() {
  const layer = useReviewStore((s) => s.layer);
  const advanceToLayer = useReviewStore((s) => s.advanceToLayer);

  // The store's `layer` still holds the layer we just finished.
  const nextLayer: LayerKey | null =
    layer === "scan" ? "reinforcement" :
    layer === "reinforcement" ? "focus" :
    null;

  // Celebratory cue on landing — once per mount.
  useEffect(() => {
    success();
  }, []);

  // Defensive: if we somehow land here on focus, go straight to complete.
  // (Don't pretend "next layer is focus" when we just finished focus.)
  useEffect(() => {
    if (!nextLayer) router.replace("/review/complete");
  }, [nextLayer]);

  const ranRef = useRef(false);
  const goNext = useCallback(() => {
    if (ranRef.current || !nextLayer) return;
    ranRef.current = true;
    // advanceToLayer closes the previous layer's review_sessions row with
    // its own counts and opens a fresh session for the next layer — this
    // is what setLayer used to do silently, losing per-layer analytics.
    advanceToLayer(nextLayer);
    if (nextLayer === "reinforcement") router.replace("/review/reinforcement");
    else router.replace("/review/focus");
  }, [advanceToLayer, nextLayer]);

  if (!nextLayer) return null;

  const finishedLabel = layerTokens[layer].label;
  const next = layerTokens[nextLayer];
  const outgoingColor = layerTokens[layer].color;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 }}>
        {/* Checklist mascot — handoff is a "done step" moment */}
        <Mascot variant="checklist" size={140} withShadow={false} />

        {/* Outgoing layer done caption */}
        <Text
          style={{
            marginTop: 14,
            fontFamily: FONT.bold,
            fontSize: 12,
            color: outgoingColor,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          {finishedLabel} completato
        </Text>

        {/* Next title */}
        <Text
          style={{
            marginTop: 10,
            fontFamily: FONT.bold,
            fontSize: 26,
            color: colors.navy,
            letterSpacing: -0.6,
            lineHeight: 30,
            textAlign: "center",
          }}
        >
          Avanti con {next.label}
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontFamily: FONT.regular,
            fontSize: 15,
            color: colors.midGrey,
            lineHeight: 22,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          {nextLayer === "reinforcement"
            ? "Richiamo guidato — ultimi 3–7 giorni, con suggerimenti quando servono."
            : "Ripasso profondo — ricordi di ieri, valutazione su tre livelli."}
        </Text>

        {/* Layer preview card */}
        <View style={{ alignSelf: "stretch", marginTop: 26 }}>
          <LayerCard
            layerKey={nextLayer}
            items={nextLayer === "reinforcement" ? 6 : 4}
            subtitle={nextLayer === "reinforcement" ? "Ultimi 3–7 giorni · ~6 min" : "Ricordi di ieri · ~6 min"}
            onPress={goNext}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 32 }}>
        <PrimaryButton label={`Inizia ${next.label}`} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}
