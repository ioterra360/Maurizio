import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { TimeBudgetChips } from "@/components/TimeBudgetChips";
import { SectionLabel } from "@/components/SectionLabel";
import { LayerCard } from "@/components/LayerCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore } from "@/lib/auth-store";
import { FONT, colors } from "@/theme/tokens";

type LayerPlan = { items: number; subtitle: string };

const PLAN: { scan: LayerPlan; reinforcement: LayerPlan; focus: LayerPlan } = {
  scan:          { items: 8, subtitle: "Old memories · ~3 min" },
  reinforcement: { items: 6, subtitle: "Last 3–7 days · ~6 min" },
  focus:         { items: 4, subtitle: "From yesterday · ~6 min" },
};

const TOTAL_ITEMS = PLAN.scan.items + PLAN.reinforcement.items + PLAN.focus.items;

export default function TodayScreen() {
  const name = useAuthStore((s) => s.user?.name ?? "");
  const firstName = name.split(" ")[0] ?? "";
  const [budget, setBudget] = useState(15);

  const greeting = useMemo(() => greetingForNow(), []);
  const dateLabel = useMemo(() => formatDateBadge(new Date()), []);
  const totalMinutes = budget;

  const startReview = () => router.push("/review/scan");
  const startLayer = (path: "scan" | "reinforcement" | "focus") =>
    router.push(`/review/${path}`);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <Text
            className="text-mid-grey"
            style={{ fontFamily: FONT.medium, fontSize: 14 }}
          >
            {greeting}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: FONT.bold,
              fontSize: 32,
              color: colors.navy,
              lineHeight: 35,
              letterSpacing: -1,
              marginTop: 2,
            }}
          >
            {firstName || "Welcome"}
          </Text>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 12,
              color: colors.midGrey,
              letterSpacing: 1.7,
              marginTop: 12,
            }}
          >
            {dateLabel}
          </Text>
        </View>

        {/* Time budget card */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <TimeBudgetChips value={budget} onChange={setBudget} />
        </View>

        {/* Recommended flow */}
        <View style={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Recommended flow</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <LayerCard
            layerKey="scan"
            items={PLAN.scan.items}
            subtitle={PLAN.scan.subtitle}
            onPress={() => startLayer("scan")}
          />
          <LayerCard
            layerKey="reinforcement"
            items={PLAN.reinforcement.items}
            subtitle={PLAN.reinforcement.subtitle}
            onPress={() => startLayer("reinforcement")}
          />
          <LayerCard
            layerKey="focus"
            items={PLAN.focus.items}
            subtitle={PLAN.focus.subtitle}
            onPress={() => startLayer("focus")}
          />
        </View>

        <Text
          style={{
            textAlign: "center",
            fontFamily: FONT.medium,
            fontSize: 13,
            color: colors.midGrey,
            paddingTop: 18,
            fontVariant: ["tabular-nums"],
          }}
        >
          Total · {TOTAL_ITEMS} items · about {totalMinutes} min
        </Text>
      </ScrollView>

      {/* Sticky CTA pinned above the tab bar */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 100,
          alignItems: "center",
          gap: 12,
        }}
      >
        <PrimaryButton label="Start Today's Review" onPress={startReview} />
        <GhostButton label="Adjust today's flow" onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function formatDateBadge(date: Date) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${days[date.getDay()]} · ${months[date.getMonth()]} ${date.getDate()}`;
}
