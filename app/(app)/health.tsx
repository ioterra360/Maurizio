import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { SectionLabel } from "@/components/SectionLabel";
import { RingChart, LegendDot } from "@/components/RingChart";
import { HealthRow } from "@/components/HealthRow";
import { CognitiveLoadBar } from "@/components/CognitiveLoadBar";
import { Tappable } from "@/components/Tappable";
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
          <HeaderHero title="Salute della memoria" reservedRight={108} />
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 2, right: 14 }}
          >
            <Mascot variant="investigate" size={92} withShadow={false} />
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
            }}
          >
            <View style={{ alignItems: "center" }}>
              <RingChart
                size={156}
                centerValue="62"
                centerLabel="Stabili"
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
                fontSize: 14,
                color: "rgba(250,248,244,0.82)",
                letterSpacing: 0.52, // 0.04em on 13px (was 1.2 = too wide)
                textTransform: "uppercase",
                fontVariant: ["tabular-nums"],
              }}
            >
              779 ricordi monitorati
            </Text>
            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                rowGap: 8,
                columnGap: 14,
              }}
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
          <HealthRow name="Japanese" active={84} fading={12} archived={4}  chip="Alta" />
          <HealthRow name="Medicine" active={78} fading={15} archived={7}  chip="Alta" />
          <HealthRow name="Spanish"  active={55} fading={32} archived={13} chip="Media" />
          <HealthRow name="Law"      active={38} fading={42} archived={20} chip="Bassa" />
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
                fontSize: 15,
                color: colors.navy,
                lineHeight: 22,
                letterSpacing: -0.05,
              }}
            >
              Japanese è la tua priorità #1, ma solo il 35% del tempo di ripasso
              di questa settimana è andato lì.
            </Text>
            <Tappable
              onPress={() => router.push({ pathname: "/folder/[kind]", params: { kind: "jp" } })}
              accessibilityLabel="Riequilibra questa settimana, vai alla cartella Japanese"
              containerStyle={{ marginTop: 6, alignSelf: "flex-end" }}
              style={{ paddingVertical: 4 }}
            >
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 14.5,
                  color: colors.reinforcement,
                  letterSpacing: -0.05,
                }}
              >
                Riequilibra questa settimana →
              </Text>
            </Tappable>
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
