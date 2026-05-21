import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminTopBar } from "@/components/AdminTopBar";
import { FLAGS, RULES, type FlagItem, type FlagSeverity } from "@/lib/admin-data";
import { FONT, colors } from "@/theme/tokens";

const SEVERITY_TINT: Record<FlagSeverity, { bg: string; text: string; label: string }> = {
  high: { bg: "#FDEEEA", text: "#A65B4A", label: "HIGH" },
  med:  { bg: "#FFF3E0", text: "#8A5A2A", label: "MED" },
  low:  { bg: "#EFEDE7", text: "#7A7975", label: "LOW" },
};

export default function AdminModerationScreen() {
  const [tab, setTab] = useState<"queue" | "rules">("queue");
  const counts = { queue: FLAGS.length, resolved: 18, auto: RULES.filter((r) => r.enabled).length };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <AdminTopBar
        title="Moderation"
        subtitle={`${counts.queue} pending · ${counts.resolved} resolved this week`}
      />

      {/* Paired pill toggle (mockup pattern), embedded count badge per tab */}
      <View className="flex-row" style={{ marginHorizontal: 16, gap: 8 }}>
        <TabPill
          label="Queue"
          count={counts.queue}
          active={tab === "queue"}
          onPress={() => setTab("queue")}
        />
        <TabPill
          label="Auto-rules"
          count={counts.auto}
          active={tab === "rules"}
          onPress={() => setTab("rules")}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "queue"
          ? FLAGS.map((f) => <FlagCard key={f.id} flag={f} />)
          : RULES.map((r) => <RuleRow key={r.id} initial={r.enabled} label={r.label} hint={r.hint} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function FlagCard({ flag }: { flag: FlagItem }) {
  const tint = SEVERITY_TINT[flag.severity];
  return (
    <View
      className="rounded-card bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: colors.hairline,
        gap: 12,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8, flexWrap: "wrap" }}>
        <View
          className="rounded-tag"
          style={{ backgroundColor: tint.bg, paddingHorizontal: 6, paddingVertical: 2 }}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 9.5,
              color: tint.text,
              letterSpacing: 0.8,
            }}
          >
            {tint.label}
          </Text>
        </View>
        {flag.source === "auto" ? (
          <View
            className="rounded-tag"
            style={{ backgroundColor: colors.divider, paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 9.5,
                color: colors.midGrey,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Auto
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 11.5,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {flag.ageHours}h ago
        </Text>
      </View>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 14,
          color: colors.navy,
          letterSpacing: -0.07,
          lineHeight: 19,
        }}
      >
        {flag.reason}
      </Text>
      <Text
        style={{
          fontFamily: FONT.regular,
          fontSize: 12.5,
          color: colors.midGrey,
          lineHeight: 17,
        }}
      >
        {flag.user} · {flag.folder} · “{flag.preview}”
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          className="flex-1 items-center justify-center rounded-chip"
          style={({ pressed }) => ({
            height: 34,
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 12.5, color: colors.navy }}>
            Review
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="flex-1 items-center justify-center rounded-chip"
          style={({ pressed }) => ({
            height: 34,
            backgroundColor: colors.active,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 13, color: colors.navy }}>
            Approve
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="flex-1 items-center justify-center rounded-chip"
          style={({ pressed }) => ({
            height: 34,
            backgroundColor: colors.fading,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 13, color: colors.navy }}>
            Remove
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} items`}
      accessibilityState={{ selected: active }}
      className="flex-1 flex-row items-center justify-center rounded-chip"
      style={({ pressed }) => ({
        height: 40,
        gap: 6,
        backgroundColor: active ? colors.navy : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: colors.hairline,
        opacity: pressed && !active ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: active ? FONT.semibold : FONT.medium,
          fontSize: 13,
          color: active ? "#fff" : colors.navy,
          letterSpacing: -0.07,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11.5,
          color: active ? "rgba(255,255,255,0.7)" : colors.midGrey,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function RuleRow({
  label,
  hint,
  initial,
}: {
  label: string;
  hint: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  return (
    <View
      className="flex-row items-center rounded-chip bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FONT.semibold, fontSize: 13.5, color: colors.navy, letterSpacing: -0.05 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey, marginTop: 2, lineHeight: 16 }}>
          {hint}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={setOn}
        trackColor={{ false: "#D9D7D1", true: colors.active }}
        thumbColor="#fff"
        ios_backgroundColor="#D9D7D1"
      />
    </View>
  );
}
