import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useReviewStore } from "@/lib/review-store";
import { FONT, colors } from "@/theme/tokens";

export default function CompleteScreen() {
  const totals = useReviewStore((s) => s.totals);
  const reset = useReviewStore((s) => s.reset);
  const total = totals.reviewed || totals.remembered + totals.struggled + totals.forgot;

  const goHome = () => {
    reset();
    router.replace("/(app)/today");
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 28,
        }}
      >
        {/* Check badge */}
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: "#E7F5EE",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            shadowColor: colors.active,
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 12 },
            shadowRadius: 24,
            elevation: 4,
          }}
        >
          <Check size={36} color={colors.active} strokeWidth={2.4} />
        </View>

        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 28,
            color: colors.navy,
            letterSpacing: -0.9,
            textAlign: "center",
            lineHeight: 32,
          }}
        >
          Today&apos;s review is done.
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 15,
            color: colors.midGrey,
            marginTop: 14,
            lineHeight: 22,
            maxWidth: 300,
            textAlign: "center",
          }}
        >
          You moved {total || 18} items closer to long-term memory. The next nudges
          will surface tomorrow.
        </Text>

        {/* Stat row */}
        <View
          className="flex-row rounded-card bg-surface"
          style={{
            marginTop: 36,
            paddingHorizontal: 28,
            paddingVertical: 18,
            gap: 36,
            borderWidth: 1,
            borderColor: colors.hairline,
          }}
        >
          <Stat label="Remembered" value={totals.remembered} color={colors.active} />
          <Stat label="Struggled" value={totals.struggled} color={colors.navy} />
          <Stat label="Forgot" value={totals.forgot} color={colors.fading} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
        <PrimaryButton label="Back to Today" onPress={goHome} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{
          fontFamily: FONT.bold,
          fontSize: 24,
          color,
          letterSpacing: -0.5,
          fontVariant: ["tabular-nums"],
          lineHeight: 26,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontFamily: FONT.semibold,
          fontSize: 11,
          color: colors.midGrey,
          letterSpacing: 0.7,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
