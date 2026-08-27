import { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminTopBar } from "@/components/AdminTopBar";
import { Tappable } from "@/components/Tappable";
import { FLAGS, RULES, type FlagItem, type FlagSeverity } from "@/lib/admin-data";
import { FONT, colors, palette, radii, severityTint, statusTint } from "@/theme/tokens";
import { useT } from "@/lib/i18n";

const SEVERITY_TINT: Record<FlagSeverity, { bg: string; text: string; label: string }> = {
  high: { bg: statusTint.fading.bg,   text: statusTint.fading.text,   label: "ALTA" },
  med:  { bg: severityTint.med.bg,    text: severityTint.med.text,    label: "MEDIA" },
  low:  { bg: statusTint.archived.bg, text: statusTint.archived.text, label: "BASSA" },
};

export default function AdminModerationScreen() {
  const { t } = useT();
  const [tab, setTab] = useState<"queue" | "rules">("queue");
  // Lifted rule-toggle state so switches survive Queue <-> Auto-rules tab switches.
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RULES.map((r) => [r.id, r.enabled] as const)),
  );
  const counts = {
    queue: FLAGS.length,
    resolved: 18,
    auto: Object.values(enabled).filter(Boolean).length,
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <AdminTopBar
        title={t("adminModeration.title")}
        subtitle={t("adminModeration.subtitle", { queue: counts.queue, resolved: counts.resolved })}
      />

      {/* Paired pill toggle (mockup pattern), embedded count badge per tab */}
      <View className="flex-row" style={{ marginHorizontal: 16, gap: 8 }}>
        <TabPill
          label={t("adminModeration.tabQueue")}
          count={counts.queue}
          active={tab === "queue"}
          onPress={() => setTab("queue")}
        />
        <TabPill
          label={t("adminModeration.tabRules")}
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
          : RULES.map((r) => (
              <RuleRow
                key={r.id}
                label={r.label}
                hint={r.hint}
                value={enabled[r.id]}
                onChange={(v) => setEnabled((prev) => ({ ...prev, [r.id]: v }))}
              />
            ))}
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
              fontSize: 10.5,
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
                fontSize: 10.5,
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
            fontSize: 13,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {flag.ageHours}h fa
        </Text>
      </View>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 15,
          color: colors.navy,
          letterSpacing: -0.07,
          lineHeight: 20,
        }}
      >
        {flag.reason}
      </Text>
      <Text
        style={{
          fontFamily: FONT.regular,
          fontSize: 13.5,
          color: colors.midGrey,
          lineHeight: 18,
        }}
      >
        {flag.user} · {flag.folder} · “{flag.preview}”
      </Text>
      <View className="flex-row" style={{ gap: 8 }}>
        <Tappable
          accessibilityRole="button"
          pressedOpacity={0.7}
          containerStyle={{ flex: 1 }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.chip,
            height: 34,
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
          }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 13.5, color: colors.navy }}>
            Esamina
          </Text>
        </Tappable>
        <Tappable
          accessibilityRole="button"
          containerStyle={{ flex: 1 }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.chip,
            height: 34,
            backgroundColor: colors.active,
          }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
            Approva
          </Text>
        </Tappable>
        <Tappable
          accessibilityRole="button"
          containerStyle={{ flex: 1 }}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.chip,
            height: 34,
            backgroundColor: palette.peach,
          }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.warmWhite }}>
            Rimuovi
          </Text>
        </Tappable>
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
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} elementi`}
      accessibilityState={{ selected: active }}
      pressedOpacity={0.65}
      containerStyle={{ flex: 1 }}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.chip,
        height: 40,
        gap: 6,
        backgroundColor: active ? colors.navy : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: colors.hairline,
      }}
    >
      <Text
        style={{
          fontFamily: active ? FONT.semibold : FONT.medium,
          fontSize: 15,
          color: active ? colors.warmWhite : colors.navy,
          letterSpacing: -0.07,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 13.5,
          color: active ? "rgba(250,248,244,0.78)" : colors.midGrey,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </Tappable>
  );
}

function RuleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
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
        <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.navy, letterSpacing: -0.05 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey, marginTop: 2, lineHeight: 17.5 }}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.switchTrackOff, true: colors.active }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.switchTrackOff}
      />
    </View>
  );
}
