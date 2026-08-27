import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
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

import { Tappable } from "@/components/Tappable";
import { AdminTopBar } from "@/components/AdminTopBar";
import { SectionLabel } from "@/components/SectionLabel";
import { RetentionCurves } from "@/components/RetentionCurves";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { ACTIVITY, FLAGS, KPIS, type KPI } from "@/lib/admin-data";
import { dateBadge, firstName } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { FONT, colors, layerTint, radii, statusTint } from "@/theme/tokens";

const ICONS: Record<"folder" | "warn" | "sparkle" | "check", LucideIcon> = {
  folder: Folder,
  warn: ShieldAlert,
  sparkle: Sparkles,
  check: CheckCircle2,
};

export default function AdminHomeScreen() {
  const { t, tp } = useT();
  const user = useAuthStore((s) => s.user);
  const display = firstName(user?.name, t("adminHome.adminFallbackName"));
  const highCount = FLAGS.filter((f) => f.severity === "high").length;
  // Reduce with a 0 seed avoids -Infinity on empty FLAGS.
  const oldestHours = FLAGS.reduce((max, f) => Math.max(max, f.ageHours), 0);
  // "{count} elementi in coda di moderazione": the first two words ("{count} elementi")
  // are the bold fragment in every catalog, so split there instead of hardcoding it.
  const queueLine = tp("adminHome.itemsInModerationQueue", FLAGS.length);
  const queueBoldEnd = queueLine.split(" ", 2).join(" ").length;
  // Measured card width so the retention chart fills the fluid card.
  const [w, setW] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar
          title={t("adminHome.greeting", { name: display })}
          subtitle={t("adminHome.subtitle", { date: dateBadge() })}
          rightSlot={
            <Tappable
              accessibilityRole="button"
              accessibilityLabel={t("adminHome.openAlertsA11y")}
              pressedOpacity={0.75}
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
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
            </Tappable>
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
          <Tappable
            onPress={() => router.push("/(admin)/moderation")}
            accessibilityRole="button"
            accessibilityLabel={t("adminHome.openModerationQueueA11y")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderRadius: radii.card,
              backgroundColor: colors.surface,
              paddingHorizontal: 16,
              paddingVertical: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderLeftWidth: 3,
              borderLeftColor: colors.fading,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 15.5,
                  color: colors.navy,
                  letterSpacing: -0.1,
                }}
              >
                <Text style={{ fontFamily: FONT.bold }}>{queueLine.slice(0, queueBoldEnd)}</Text>
                {queueLine.slice(queueBoldEnd)}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 13.5,
                  color: colors.midGrey,
                  marginTop: 3,
                }}
              >
                {t("adminHome.moderationSummary", { highCount, hours: oldestHours })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.placeholder} strokeWidth={1.8} />
          </Tappable>
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
              <SectionLabel size="lg">{t("adminHome.retentionTitle")}</SectionLabel>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 13,
                  color: colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {t("adminHome.retentionSubtitle")}
              </Text>
            </View>
            <View
              onLayout={(e) => setW(e.nativeEvent.layout.width)}
              style={{ marginTop: 12, minHeight: 90 }}
            >
              {w > 0 && <RetentionCurves width={w} height={90} />}
            </View>
            <View className="mt-2 flex-row justify-between" style={{ marginTop: 10 }}>
              <CompactLegend color={colors.scan} label={t("adminHome.legendScan")} val="62%" />
              <CompactLegend
                color={colors.reinforcement}
                label={t("adminHome.legendReinforcement")}
                val="74%"
              />
              <CompactLegend color={colors.focus} label={t("adminHome.legendFocus")} val="91%" />
            </View>
          </View>
        </View>

        {/* Activity feed */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel size="lg">{t("adminHome.activityTitle")}</SectionLabel>
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
                      fontSize: 14,
                      color: colors.navy,
                      letterSpacing: -0.05,
                    }}
                  >
                    {a.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 13.5,
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
                    fontSize: 13,
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
          fontSize: 12,
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
            fontSize: 13,
            color: up ? statusTint.active.text : statusTint.fading.text,
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
      <Text style={{ fontFamily: FONT.medium, fontSize: 12.5, color: colors.midGrey }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 12.5,
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
  if (color === colors.active)        return statusTint.active.bg;
  if (color === colors.fading)        return statusTint.fading.bg;
  if (color === colors.reinforcement) return layerTint.reinforcement;
  if (color === colors.scan)          return layerTint.scan;
  if (color === colors.navy)          return layerTint.focus;
  return colors.divider;
}
