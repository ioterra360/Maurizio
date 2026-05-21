import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { TimeBudgetChips } from "@/components/TimeBudgetChips";
import { SectionLabel } from "@/components/SectionLabel";
import { LayerCard } from "@/components/LayerCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { CoachTip } from "@/components/CoachTip";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { useReviewStore } from "@/lib/review-store";
import { firstName, dateBadge, timeGreeting } from "@/lib/format";
import { pickTip } from "@/lib/coach-tips";
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
  const display = firstName(name, "Welcome");
  const [budget, setBudget] = useState(15);

  // Recompute date label each render so a day rollover during a long session
  // doesn't leave a stale "MON · MAY 18" header.
  const greeting = timeGreeting();
  const dateLabel = useMemo(() => dateBadge(), []);
  const dayOfYear = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  }, []);
  const todayTip = useMemo(() => pickTip("today", dayOfYear), [dayOfYear]);

  const startSession = useReviewStore((s) => s.start);

  // Initialize the review-store BEFORE navigating so the destination
  // screen's useFocusEffect sees the right mode/session. Skipping this
  // step let a same-layer pending request from an abandoned flow
  // suppress the new direct-entry session (Codex P2 on 6b777ad).
  const startReview = () => {
    startSession("scan", "flow");
    router.push("/review/scan");
  };
  const startLayer = (path: "scan" | "reinforcement" | "focus") => {
    startSession(path, "single");
    router.push(`/review/${path}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 240 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero with mascot peek — single two-line title + a small
            coach mascot floating top-right to keep brand presence */}
        <View style={{ paddingHorizontal: 28, paddingTop: 22, flexDirection: "row" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: FONT.bold,
                fontSize: 32,
                color: colors.navy,
                lineHeight: 42,
                letterSpacing: -1,
                paddingBottom: 2,
              }}
            >
              {greeting}
              {"\n"}
              {display}
            </Text>
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 12.5,
                color: colors.midGrey,
                letterSpacing: 1.68,
                marginTop: 12,
              }}
            >
              {dateLabel}
            </Text>
          </View>
          <View style={{ marginLeft: 8, marginTop: 4 }}>
            <Mascot variant="idea" size={72} withShadow={false} />
          </View>
        </View>

        {/* Time budget card */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <TimeBudgetChips value={budget} onChange={setBudget} />
        </View>

        {/* Coach tip — rotates daily so the user sees fresh advice */}
        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <CoachTip tip={todayTip} persistDismiss={false} />
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
            fontFamily: FONT.regular,
            fontSize: 13,
            color: colors.midGrey,
            paddingTop: 18,
            fontVariant: ["tabular-nums"],
          }}
        >
          Total · {TOTAL_ITEMS} items · about {budget} min
        </Text>
      </ScrollView>

      {/* Sticky CTA pinned above the tab bar */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 96,
          alignItems: "center",
          gap: 12,
        }}
      >
        <PrimaryButton label="Start Today's Review" onPress={startReview} />
        <GhostButton
          label="Adjust today's flow"
          onPress={() => router.push("/settings")}
        />
      </View>
    </SafeAreaView>
  );
}
