import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useReviewStore } from "@/lib/review-store";
import { success } from "@/lib/feedback";
import { FONT, colors } from "@/theme/tokens";

export default function CompleteScreen() {
  const totals = useReviewStore((s) => s.totals);
  const reset = useReviewStore((s) => s.reset);
  const total = totals.reviewed || totals.remembered + totals.struggled + totals.forgot;

  // Celebratory cue on landing — once per mount.
  useEffect(() => {
    success();
  }, []);

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
        {/* Celebratory mascot — checklist variant (job done) */}
        <Mascot variant="checklist" size={160} withShadow={false} />

        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 30,
            color: colors.navy,
            letterSpacing: -0.9,
            textAlign: "center",
            lineHeight: 36,
            marginTop: 12,
          }}
        >
          Ripasso di oggi completato!
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 16,
            color: colors.midGrey,
            marginTop: 14,
            lineHeight: 24,
            maxWidth: 320,
            textAlign: "center",
          }}
        >
          Hai avvicinato {total || 18} ricordi alla memoria di lungo termine.
          I prossimi spunti torneranno domani.
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
          <Stat label="Ricordati" value={totals.remembered} color={colors.active} />
          <Stat label="Difficili" value={totals.struggled} color={colors.navy} />
          <Stat label="Dimenticati" value={totals.forgot} color={colors.fading} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
        <PrimaryButton label="Torna a Oggi" onPress={goHome} />
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
