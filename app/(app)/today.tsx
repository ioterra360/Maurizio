import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { TimeBudgetChips } from "@/components/TimeBudgetChips";
import { SectionLabel } from "@/components/SectionLabel";
import { LayerCard } from "@/components/LayerCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { DECK_SIZES, useReviewStore } from "@/lib/review-store";
import { firstName, dateBadge, timeGreeting } from "@/lib/format";
import { FONT, colors } from "@/theme/tokens";

// Item counts come from the review-store decks — the same decks the CTAs
// actually launch — so the plan can never contradict the session it starts.
// Minute estimates stay local until Phase 3D threads the time budget into
// fetchDueMemoriesByLayer.
const PLAN = {
  scan:          { items: DECK_SIZES.scan,          minutes: 3 },
  reinforcement: { items: DECK_SIZES.reinforcement, minutes: 6 },
  focus:         { items: DECK_SIZES.focus,         minutes: 6 },
} as const;

const TOTAL_ITEMS = PLAN.scan.items + PLAN.reinforcement.items + PLAN.focus.items;
const TOTAL_MINUTES = PLAN.scan.minutes + PLAN.reinforcement.minutes + PLAN.focus.minutes;

export default function TodayScreen() {
  const name = useAuthStore((s) => s.user?.name ?? "");
  const display = firstName(name, "Benvenuto");
  const [budget, setBudget] = useState(15);

  // Recompute date label each render so a day rollover during a long session
  // doesn't leave a stale "MON · MAY 18" header.
  const greeting = timeGreeting();
  const dateLabel = dateBadge();
  // Recommended flow subtitle pulled out so we can localize cleanly.
  const PLAN_LABELS = {
    scan:          `Ricordi più vecchi · ~${PLAN.scan.minutes} min`,
    reinforcement: `Ultimi 3–7 giorni · ~${PLAN.reinforcement.minutes} min`,
    focus:         `Ricordi di ieri · ~${PLAN.focus.minutes} min`,
  } as const;
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
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero with mascot peek — mascot is absolutely positioned
            so the 32pt heading keeps the full width on narrow phones (e.g.
            iPhone SE) rather than wrapping prematurely. */}
        <View style={{ paddingHorizontal: 28, paddingTop: 22, position: "relative" }}>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            numberOfLines={2}
            style={{
              fontFamily: FONT.bold,
              fontSize: 32,
              color: colors.navy,
              lineHeight: 42,
              letterSpacing: -1,
              paddingBottom: 2,
              paddingRight: 96,
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
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 4, right: 8 }}
          >
            <Mascot variant="idea" size={104} withShadow={false} />
          </View>
        </View>

        {/* Time budget chips */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <TimeBudgetChips value={budget} onChange={setBudget} />
        </View>

        {/* Recommended flow */}
        <View style={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 8 }}>
          <SectionLabel>Flusso consigliato</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <LayerCard
            layerKey="scan"
            items={PLAN.scan.items}
            subtitle={PLAN_LABELS.scan}
            onPress={() => startLayer("scan")}
          />
          <LayerCard
            layerKey="reinforcement"
            items={PLAN.reinforcement.items}
            subtitle={PLAN_LABELS.reinforcement}
            onPress={() => startLayer("reinforcement")}
          />
          <LayerCard
            layerKey="focus"
            items={PLAN.focus.items}
            subtitle={PLAN_LABELS.focus}
            onPress={() => startLayer("focus")}
          />
        </View>

        {/* CTA — in normal flow at the bottom of the page (no floating layer),
            so it can never overlap the Focus card or anything else. */}
        <View style={{ paddingHorizontal: 20, marginTop: 28, alignItems: "center", gap: 12 }}>
          <Text
            style={{
              textAlign: "center",
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              fontVariant: ["tabular-nums"],
            }}
          >
            Totale · {TOTAL_ITEMS} ricordi · circa {TOTAL_MINUTES} min
          </Text>
          <PrimaryButton label="Inizia il ripasso di oggi" onPress={startReview} />
          <GhostButton
            label="Aggiusta il flusso di oggi"
            onPress={() => router.push("/settings")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
