import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminTopBar } from "@/components/AdminTopBar";
import { FLAGS, RULES, type FlagItem, type FlagSeverity } from "@/lib/admin-data";
import { FONT, colors, palette, severityTint, statusTint } from "@/theme/tokens";

const SEVERITY_TINT: Record<FlagSeverity, { bg: string; text: string; label: string }> = {
  high: { bg: statusTint.fading.bg,   text: statusTint.fading.text,   label: "ALTA" },
  med:  { bg: severityTint.med.bg,    text: severityTint.med.text,    label: "MEDIA" },
  low:  { bg: statusTint.archived.bg, text: statusTint.archived.text, label: "BASSA" },
};

export default function AdminModerationScreen() {
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
        title="Moderazione"
        subtitle={`${counts.queue} in coda · ${counts.resolved} risolte questa settimana`}
      />

      {/* Paired pill toggle (mockup pattern), embedded count badge per tab */}
      <View className="flex-row" style={{ marginHorizontal: 16, gap: 8 }}>
        <TabPill
          label="Coda"
          count={counts.queue}
          active={tab === "queue"}
          onPress={() => setTab("queue")}
        />
        <TabPill
          label="Regole auto"
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
          {flag.ageHours}h fa
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
            Esamina
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
            Approva
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="flex-1 items-center justify-center rounded-chip"
          style={({ pressed }) => ({
            height: 34,
            backgroundColor: palette.peach,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 13, color: colors.warmWhite }}>
            Rimuovi
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
      accessibilityLabel={`${label}, ${count} elementi`}
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
          fontSize: 14,
          color: active ? colors.warmWhite : colors.navy,
          letterSpacing: -0.07,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 12,
          color: active ? "rgba(250,248,244,0.78)" : colors.midGrey,
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
        <Text style={{ fontFamily: FONT.semibold, fontSize: 13.5, color: colors.navy, letterSpacing: -0.05 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey, marginTop: 2, lineHeight: 16 }}>
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
