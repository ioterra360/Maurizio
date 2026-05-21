import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderHero } from "@/components/HeaderHero";
import { SectionLabel } from "@/components/SectionLabel";
import { RingChart, LegendDot } from "@/components/RingChart";
import { HealthRow } from "@/components/HealthRow";
import { CognitiveLoadBar } from "@/components/CognitiveLoadBar";
import { Mascot } from "@/components/Mascot";
import { FONT, colors } from "@/theme/tokens";

export default function HealthScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <HeaderHero title="Salute della memoria" reservedRight={80} />
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 14, right: 18 }}
          >
            <Mascot variant="investigate" size={64} withShadow={false} />
          </View>
        </View>

        {/* Hero ring on navy panel */}
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              backgroundColor: colors.navy,
              borderRadius: 18,
              paddingVertical: 24,
              paddingHorizontal: 20,
              overflow: "hidden",
              shadowColor: colors.navy,
              shadowOpacity: 0.18,
              shadowOffset: { width: 0, height: 18 },
              shadowRadius: 32,
              elevation: 6,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <RingChart
                size={156}
                centerValue="62"
                centerLabel="Stable"
                segments={[
                  { color: colors.active, pct: 62 },
                  { color: colors.fading, pct: 24 },
                  { color: colors.archived, pct: 14 },
                ]}
              />
            </View>
            <Text
              style={{
                textAlign: "center",
                marginTop: 14,
                fontFamily: FONT.medium,
                fontSize: 13,
                color: "rgba(250,248,244,0.82)",
                letterSpacing: 0.52, // 0.04em on 13px (was 1.2 = too wide)
                textTransform: "uppercase",
                fontVariant: ["tabular-nums"],
              }}
            >
              779 ricordi monitorati
            </Text>
            <View
              className="flex-row justify-center"
              style={{ marginTop: 14, gap: 14 }}
            >
              <LegendDot color={colors.active} label="Stabili" pct="62%" />
              <LegendDot color={colors.fading} label="In dissolvenza" pct="24%" />
              <LegendDot color={colors.archived} label="Archiviati" pct="14%" />
            </View>
          </View>
        </View>

        {/* Folder breakdown */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Per cartella</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <HealthRow name="Japanese" active={84} fading={12} archived={4}  chip="High" />
          <HealthRow name="Medicine" active={78} fading={15} archived={7}  chip="High" />
          <HealthRow name="Spanish"  active={55} fading={32} archived={13} chip="Medium" />
          <HealthRow name="Law"      active={38} fading={42} archived={20} chip="Low" />
        </View>

        {/* Insight card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderLeftWidth: 2.5,
              borderLeftColor: colors.reinforcement,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 14,
                color: colors.navy,
                lineHeight: 20,
                letterSpacing: -0.05,
              }}
            >
              Japanese è la tua priorità #1, ma solo il 35% del tempo di ripasso
              di questa settimana è andato lì.
            </Text>
            <Text
              style={{
                marginTop: 10,
                textAlign: "right",
                fontFamily: FONT.semibold,
                fontSize: 13,
                color: colors.reinforcement,
                letterSpacing: -0.05,
              }}
            >
              Riequilibra questa settimana →
            </Text>
          </View>
        </View>

        {/* Cognitive load */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Carico cognitivo</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <CognitiveLoadBar pct={62} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
