import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminTopBar } from "@/components/AdminTopBar";
import { SectionLabel } from "@/components/SectionLabel";
import { FUNNEL, RECALL } from "@/lib/admin-data";
import { useT } from "@/lib/i18n";
import { FONT, colors } from "@/theme/tokens";

export default function AdminInsightsScreen() {
  const { t, locale } = useT();

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar title={t("adminInsights.title")} subtitle={t("adminInsights.subtitle")} />

        {/* Onboarding funnel */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <SectionLabel>{t("adminInsights.funnelTitle")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingVertical: 20,
              borderWidth: 1,
              borderColor: colors.hairline,
              gap: 12,
            }}
          >
            {FUNNEL.map((step, i) => {
              const drop = i === 0 ? null : FUNNEL[i - 1].value - step.value;
              return (
                <View key={step.label} className="flex-row items-center" style={{ gap: 10 }}>
                  <View style={{ width: 14, alignItems: "center" }}>
                    <Text
                      style={{
                        fontFamily: FONT.bold,
                        fontSize: 11,
                        color: colors.midGrey,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-baseline justify-between">
                      <Text
                        style={{
                          fontFamily: FONT.semibold,
                          fontSize: 14,
                          color: colors.navy,
                          letterSpacing: -0.05,
                        }}
                      >
                        {step.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONT.bold,
                          fontSize: 14,
                          color: colors.navy,
                          fontVariant: ["tabular-nums"],
                        }}
                      >
                        {`${step.pct.toLocaleString(locale)}%`}
                      </Text>
                    </View>
                    <View
                      style={{
                        marginTop: 5,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.divider,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          height: "100%",
                          width: `${step.pct}%`,
                          backgroundColor: colors.navy,
                          opacity: 1 - i * 0.13,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: FONT.regular,
                        fontSize: 13.5,
                        color: colors.midGrey,
                        marginTop: 4,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {step.value.toLocaleString(locale)}
                      {drop !== null ? ` · -${drop.toLocaleString(locale)}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* D7 → D30 callout */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingVertical: 18,
              borderWidth: 1,
              borderColor: colors.hairline,
              borderLeftWidth: 3,
              borderLeftColor: colors.reinforcement,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 14.5,
                color: colors.navy,
                lineHeight: 20,
                letterSpacing: -0.04,
              }}
            >
              <Text style={{ fontFamily: FONT.bold }}>{t("adminInsights.d7d30CalloutLead")}</Text>{" "}
              {t("adminInsights.d7d30CalloutBody")}
            </Text>
          </View>
        </View>

        {/* Recall accuracy by folder */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>{t("adminInsights.recallByFolderTitle")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {RECALL.map((row) => (
            <View
              key={row.folder}
              className="rounded-chip bg-surface"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 14,
                    color: colors.navy,
                    letterSpacing: -0.05,
                  }}
                >
                  {row.folder}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.bold,
                    fontSize: 14,
                    color: colors.navy,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {row.accuracy}%
                </Text>
              </View>
              <View
                style={{
                  marginTop: 6,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: row.color,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${row.accuracy}%`,
                    backgroundColor: colors.navy,
                  }}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Review layer adoption */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>{t("adminInsights.layerAdoptionTitle")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <LayerAdoption color={colors.scan} label={t("adminInsights.layerScan")} sessions={42_810} share={0.48} />
          <LayerAdoption
            color={colors.reinforcement}
            label={t("adminInsights.layerReinforcement")}
            sessions={28_410}
            share={0.32}
          />
          <LayerAdoption color={colors.focus} label={t("adminInsights.layerFocus")} sessions={17_840} share={0.20} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LayerAdoption({
  color,
  label,
  sessions,
  share,
}: {
  color: string;
  label: string;
  sessions: number;
  share: number;
}) {
  const { tp, locale } = useT();

  return (
    <View
      className="rounded-chip bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View className="flex-row items-baseline justify-between">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 14,
              color: colors.navy,
              letterSpacing: -0.05,
            }}
          >
            {label}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 14,
            color: colors.navy,
            fontVariant: ["tabular-nums"],
          }}
        >
          {Math.round(share * 100)}%
        </Text>
      </View>
      <View
        style={{
          marginTop: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.divider,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.round(share * 100)}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: FONT.regular,
          fontSize: 13.5,
          color: colors.midGrey,
          marginTop: 5,
          fontVariant: ["tabular-nums"],
        }}
      >
        {tp("adminInsights.sessions", sessions, { count: sessions.toLocaleString(locale) })}
      </Text>
    </View>
  );
}
