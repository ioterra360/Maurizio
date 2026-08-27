import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";
import { useReviewStore } from "@/lib/review-store";
import { success } from "@/lib/feedback";
import { FONT, colors, layer as layerTokens, type LayerKey } from "@/theme/tokens";

/**
 * Interstitial automatico tra i livelli del flusso fluido: nessun tap
 * richiesto — celebra il livello chiuso, annuncia il prossimo e avanza da
 * solo dopo un momento (spec core-loop §5).
 */
export default function ReviewHandoffScreen() {
  const { t } = useT();
  const layer = useReviewStore((s) => s.layer);
  const layerCaps = useReviewStore((s) => s.layerCaps);
  const advanceToLayer = useReviewStore((s) => s.advanceToLayer);

  // The store's `layer` still holds the layer we just finished. Skip planned-
  // empty layers so the flow can never strand the user on a deck with zero
  // cards (caps unknown → defensive entry, don't skip anything).
  const chain: LayerKey[] =
    layer === "scan"
      ? ["reinforcement", "focus"]
      : layer === "reinforcement"
        ? ["focus"]
        : [];
  const nextLayer: LayerKey | null =
    chain.find((l) => (layerCaps ? layerCaps[l] > 0 : true)) ?? null;

  // Celebratory cue on landing — once per mount.
  useEffect(() => {
    success();
  }, []);

  // Defensive: nothing left to run — straight to the recap.
  useEffect(() => {
    if (!nextLayer) router.replace("/review/complete");
  }, [nextLayer]);

  const ranRef = useRef(false);
  const goNext = useCallback(() => {
    if (ranRef.current || !nextLayer) return;
    ranRef.current = true;
    // advanceToLayer closes the previous layer's review_sessions row with
    // its own counts and opens a fresh session for the next layer.
    advanceToLayer(nextLayer);
    if (nextLayer === "reinforcement") router.replace("/review/reinforcement");
    else router.replace("/review/focus");
  }, [advanceToLayer, nextLayer]);

  // Interstitial automatico: goNext è idempotente via ranRef, quindi un
  // unmount anticipato non può double-fire.
  useEffect(() => {
    const timer = setTimeout(goNext, 1100);
    return () => clearTimeout(timer);
  }, [goNext]);

  if (!nextLayer) return null;

  const finishedLabel = layerTokens[layer].label;
  const next = layerTokens[nextLayer];
  const outgoingColor = layerTokens[layer].color;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 }}>
        {/* Checklist mascot — handoff is a "done step" moment */}
        <Mascot variant="checklist" size={164} withShadow={false} />

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
          {t("handoff.layerCompleted", { layer: finishedLabel })}
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
          {t("handoff.nextUp", { layer: next.label })}
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
            ? t("handoff.reinforcementBlurb")
            : t("handoff.focusBlurb")}
        </Text>

        {/* Puntini di transizione col colore del livello in arrivo */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 22 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: next.color,
                opacity: 0.35 + i * 0.3,
              }}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
