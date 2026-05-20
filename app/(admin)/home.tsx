import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bell,
  ChevronRight,
  Folder,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";

import { AdminTopBar } from "@/components/AdminTopBar";
import { SectionLabel } from "@/components/SectionLabel";
import { RetentionCurves } from "@/components/RetentionCurves";
import { useAuthStore } from "@/lib/auth-store";
import { ACTIVITY, KPIS, type KPI } from "@/lib/admin-data";
import { firstName } from "@/lib/format";
import { FONT, colors } from "@/theme/tokens";

const ICONS: Record<"folder" | "warn" | "sparkle" | "check", LucideIcon> = {
  folder: Folder,
  warn: ShieldAlert,
  sparkle: Sparkles,
  check: CheckCircle2,
};

export default function AdminHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const display = firstName(user?.name, "Admin");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar
          title={`Hi, ${display}`}
          subtitle="Production · MON · MAY 19"
          rightSlot={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open alerts"
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 11,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.hairline,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Bell size={17} color={colors.navy} strokeWidth={1.8} />
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.fading,
                  borderWidth: 1.5,
                  borderColor: colors.warmWhite,
                }}
              />
            </Pressable>
          }
        />

        {/* 2x2 KPI grid */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <View className="flex-row" style={{ gap: 12 }}>
            <KpiCard kpi={KPIS[0]} />
            <KpiCard kpi={KPIS[1]} />
          </View>
          <View className="flex-row" style={{ gap: 12, marginTop: 12 }}>
            <KpiCard kpi={KPIS[2]} />
            <KpiCard kpi={KPIS[3]} />
          </View>
        </View>

        {/* Moderation alert callout */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Pressable
            onPress={() => router.push("/(admin)/moderation")}
            accessibilityRole="button"
            accessibilityLabel="Open moderation queue"
            className="flex-row items-center rounded-card bg-surface"
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderLeftWidth: 3,
              borderLeftColor: colors.fading,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 12.5,
                  color: colors.navy,
                  letterSpacing: -0.05,
                }}
              >
                <Text style={{ fontFamily: FONT.bold }}>5 items</Text> in moderation queue
              </Text>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 11.5,
                  color: colors.midGrey,
                  marginTop: 2,
                }}
              >
                3 high severity · oldest 4h ago
              </Text>
            </View>
            <ChevronRight size={18} color="#C0BEB8" strokeWidth={1.8} />
          </Pressable>
        </View>

        {/* Retention chart */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingVertical: 20,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <View className="flex-row items-center justify-between">
              <SectionLabel size="lg">Retention · 30d</SectionLabel>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 11.5,
                  color: colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                survival by layer
              </Text>
            </View>
            <View style={{ marginTop: 12, alignItems: "stretch" }}>
              <RetentionCurves width={320} height={90} />
            </View>
            <View className="mt-2 flex-row justify-between" style={{ marginTop: 10 }}>
              <CompactLegend color={colors.focus} label="Focus" val="91%" />
              <CompactLegend color={colors.reinforcement} label="Reinforce" val="74%" />
              <CompactLegend color={colors.scan} label="Scan" val="62%" />
            </View>
          </View>
        </View>

        {/* Activity feed */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel size="lg">Activity</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {ACTIVITY.map((a, i) => {
            const Icon = ICONS[a.iconKind];
            return (
              <View
                key={i}
                className="flex-row items-center rounded-chip bg-surface"
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 14,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: tintFor(a.color),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={15} color={a.color} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FONT.semibold,
                      fontSize: 13,
                      color: colors.navy,
                      letterSpacing: -0.05,
                    }}
                  >
                    {a.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 12,
                      color: colors.midGrey,
                      marginTop: 1,
                    }}
                  >
                    {a.body}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 11.5,
                    color: colors.midGrey,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {a.time}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ kpi }: { kpi: KPI }) {
  const up = kpi.delta.startsWith("+");
  return (
    <View
      className="flex-1 overflow-hidden rounded-chip bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: colors.hairline,
        position: "relative",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          backgroundColor: kpi.accent,
        }}
      />
      <Text
        style={{
          fontFamily: FONT.bold,
          fontSize: 10.5,
          color: colors.midGrey,
          letterSpacing: 1.05, // 0.1em on 10.5px
          textTransform: "uppercase",
        }}
      >
        {kpi.label}
      </Text>
      <View
        className="flex-row items-baseline justify-between"
        style={{ marginTop: 6 }}
      >
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 21,
            color: colors.navy,
            letterSpacing: -0.42,
            fontVariant: ["tabular-nums"],
            lineHeight: 22,
          }}
        >
          {kpi.value}
        </Text>
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11.5,
            color: up ? colors.active : colors.fading,
            fontVariant: ["tabular-nums"],
          }}
        >
          {kpi.delta}
        </Text>
      </View>
    </View>
  );
}

function CompactLegend({ color, label, val }: { color: string; label: string; val: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: FONT.medium, fontSize: 11.5, color: colors.midGrey }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11.5,
          color: colors.navy,
          fontVariant: ["tabular-nums"],
        }}
      >
        {val}
      </Text>
    </View>
  );
}

function tintFor(color: string): string {
  if (color === colors.active)        return "#E7F5EE";
  if (color === colors.fading)        return "#FDEEEA";
  if (color === colors.reinforcement) return "#F1EEFC";
  if (color === colors.scan)          return "#E6F0FA";
  if (color === colors.navy)          return "#EDF0F6";
  return "#EFEDE7";
}
