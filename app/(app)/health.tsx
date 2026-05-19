import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderHero } from "@/components/HeaderHero";
import { SectionLabel } from "@/components/SectionLabel";
import { RingChart, LegendDot } from "@/components/RingChart";
import { HealthRow } from "@/components/HealthRow";
import { CognitiveLoadBar } from "@/components/CognitiveLoadBar";
import { FONT, colors } from "@/theme/tokens";

export default function HealthScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <HeaderHero title="Memory Health" />

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
                  { color: "#9C9C95", pct: 14 },
                ]}
              />
            </View>
            <Text
              style={{
                textAlign: "center",
                marginTop: 14,
                fontFamily: FONT.medium,
                fontSize: 12.5,
                color: "rgba(255,255,255,0.78)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontVariant: ["tabular-nums"],
              }}
            >
              1,024 items tracked
            </Text>
            <View
              className="flex-row justify-center"
              style={{ marginTop: 14, gap: 14 }}
            >
              <LegendDot color={colors.active} label="Stable" pct="62%" />
              <LegendDot color={colors.fading} label="Fading" pct="24%" />
              <LegendDot color="#9C9C95" label="Archived" pct="14%" />
            </View>
          </View>
        </View>

        {/* Folder breakdown */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>By folder</SectionLabel>
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
              Japanese is your #1 priority, but only 35% of your review time went
              there this week.
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
              Rebalance this week →
            </Text>
          </View>
        </View>

        {/* Cognitive load */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Cognitive load</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <CognitiveLoadBar pct={62} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
