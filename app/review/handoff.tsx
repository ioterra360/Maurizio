import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/PrimaryButton";
import { LayerCard } from "@/components/LayerCard";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors, layer as layerTokens, type LayerKey } from "@/theme/tokens";

export default function ReviewHandoffScreen() {
  const layer = useReviewStore((s) => s.layer);
  const advanceToLayer = useReviewStore((s) => s.advanceToLayer);

  // The store's `layer` still holds the layer we just finished.
  const nextLayer: LayerKey | null =
    layer === "scan" ? "reinforcement" :
    layer === "reinforcement" ? "focus" :
    null;

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
        {/* Green check badge */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#E7F5EE",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.active,
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 10 },
            shadowRadius: 20,
            elevation: 3,
          }}
        >
          <Check size={28} color={colors.active} strokeWidth={2.4} />
        </View>

        {/* Outgoing layer done caption */}
        <Text
          style={{
            marginTop: 24,
            fontFamily: FONT.bold,
            fontSize: 11,
            color: outgoingColor,
            letterSpacing: 1.32,
            textTransform: "uppercase",
          }}
        >
          {finishedLabel} done
        </Text>

        {/* Next title */}
        <Text
          style={{
            marginTop: 8,
            fontFamily: FONT.bold,
            fontSize: 24,
            color: colors.navy,
            letterSpacing: -0.6,
            lineHeight: 28,
            textAlign: "center",
          }}
        >
          On to {next.label}
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontFamily: FONT.regular,
            fontSize: 14,
            color: colors.midGrey,
            lineHeight: 20,
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          {nextLayer === "reinforcement"
            ? "Guided recall — last 3–7 days, with hints when you need them."
            : "Deep review — yesterday's items, three-way recall."}
        </Text>

        {/* Layer preview card */}
        <View style={{ alignSelf: "stretch", marginTop: 28 }}>
          <LayerCard
            layerKey={nextLayer}
            items={nextLayer === "reinforcement" ? 6 : 4}
            subtitle={nextLayer === "reinforcement" ? "Last 3–7 days · ~6 min" : "From yesterday · ~6 min"}
            onPress={goNext}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 32 }}>
        {/* CTA stays in the unified navy family — same dark blue as
            "Start Today's Review" and the in-review Remember/Continue
            buttons. The next-layer color identity is already carried by
            the LayerCard preview + the "ON TO X" header above. */}
        <PrimaryButton label={`Start ${next.label}`} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}
