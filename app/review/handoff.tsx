import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Radar, Repeat, Target, type LucideIcon } from "lucide-react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors, layer as layerTokens, type LayerKey } from "@/theme/tokens";

const ICONS: Record<LayerKey, LucideIcon> = {
  scan: Radar,
  reinforcement: Repeat,
  focus: Target,
};

export default function ReviewHandoffScreen() {
  const layer = useReviewStore((s) => s.layer);
  const setLayer = useReviewStore((s) => s.setLayer);
  // After we get here the store still says the layer we just finished;
  // figure out the next one and trigger the layer reset.
  const nextLayer: LayerKey =
    layer === "scan" ? "reinforcement" : layer === "reinforcement" ? "focus" : "focus";

  const { color, label } = layerTokens[nextLayer];
  const Icon = ICONS[nextLayer];

  const goNext = useCallback(() => {
    setLayer(nextLayer);
    if (nextLayer === "reinforcement") router.replace("/review/reinforcement");
    else router.replace("/review/focus");
  }, [setLayer, nextLayer]);

  useEffect(() => {
    const t = setTimeout(goNext, 2200);
    return () => clearTimeout(t);
  }, [goNext]);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11,
            color: colors.midGrey,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          {layer === "scan" ? "Scan done" : "Reinforcement done"} · on to {label}
        </Text>

        <View
          style={{
            marginTop: 28,
            width: 88,
            height: 88,
            borderRadius: 24,
            backgroundColor: color === colors.focus ? colors.tagUserBg : color === colors.reinforcement ? "#F1EEFC" : "#E6F0FA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={42} color={color} strokeWidth={1.7} />
        </View>

        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 30,
            color: colors.navy,
            letterSpacing: -0.9,
            marginTop: 22,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 14,
            color: colors.midGrey,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 20,
            maxWidth: 280,
          }}
        >
          {nextLayer === "reinforcement"
            ? "Guided recall — last 3–7 days, with hints when you need them."
            : "Deep review — yesterday's items, three-way recall."}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 32 }}>
        <PrimaryButton label={`Continue with ${label}`} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}
