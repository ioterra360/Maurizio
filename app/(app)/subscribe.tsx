import { useState } from "react";
import {
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import {
  ChevronLeft,
  Sparkles,
  Infinity as InfinityIcon,
  ShieldCheck,
  Radar,
} from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { Tappable } from "@/components/Tappable";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore } from "@/lib/auth-store";
import { PREMIUM_ENABLED } from "@/lib/constants";
import { useT, type TKey } from "@/lib/i18n";
import { colors, FONT } from "@/theme/tokens";

const CHECKOUT_URL = "https://ioterra360.github.io/memika-legal/";

// Catalog keys only — the text is resolved at render so the Settings
// language switch applies at once.
const BENEFITS: {
  id: string;
  icon: typeof InfinityIcon;
  titleKey: TKey;
  bodyKey: TKey;
}[] = [
  {
    id: "unlimited",
    icon: InfinityIcon,
    titleKey: "subscribe.benefitUnlimitedTitle",
    bodyKey: "subscribe.benefitUnlimitedBody",
  },
  {
    id: "rhythms",
    icon: Radar,
    titleKey: "subscribe.benefitRhythmsTitle",
    bodyKey: "subscribe.benefitRhythmsBody",
  },
  {
    id: "insights",
    icon: Sparkles,
    titleKey: "subscribe.benefitInsightsTitle",
    bodyKey: "subscribe.benefitInsightsBody",
  },
  {
    id: "safe",
    icon: ShieldCheck,
    titleKey: "subscribe.benefitSafeTitle",
    bodyKey: "subscribe.benefitSafeBody",
  },
];

export default function SubscribeScreen() {
  const { t } = useT();
  const userEmail = useAuthStore((s) => s.user?.email ?? "");
  const [opening, setOpening] = useState(false);

  // Kill-switch: a deep link to memika://subscribe must not surface the
  // external checkout while the paywall is disabled (Apple 3.1.1).
  if (!PREMIUM_ENABLED) return <Redirect href="/(app)/settings" />;

  const openCheckout = async () => {
    setOpening(true);
    try {
      const url = userEmail
        ? `${CHECKOUT_URL}?email=${encodeURIComponent(userEmail)}`
        : CHECKOUT_URL;
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
    } finally {
      setOpening(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
          <Tappable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={10}
            pressedOpacity={0.6}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
          </Tappable>
        </View>

        {/* Announce mascot — premium pitch lead */}
        <View style={{ alignItems: "center", marginTop: 4, marginBottom: -8 }}>
          <Mascot variant="announce" size={128} withShadow={false} />
        </View>

        {/* Hero — navy panel, warm-white inside (high contrast) */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 12,
            borderRadius: 18,
            backgroundColor: colors.navy,
            padding: 24,
          }}
        >
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.16)",
              marginBottom: 18,
            }}
          >
            <Sparkles size={12} color={colors.warmWhite} strokeWidth={2} />
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 10.5,
                color: colors.warmWhite,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              {t("subscribe.premiumBadge")}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 26,
              lineHeight: 32,
              letterSpacing: -0.4,
              color: colors.warmWhite,
            }}
          >
            {t("subscribe.heroTitle")}
          </Text>
          <Text
            style={{
              marginTop: 12,
              fontFamily: FONT.regular,
              fontSize: 14.5,
              lineHeight: 22,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {t("subscribe.heroBody")}
          </Text>

          <View
            style={{
              marginTop: 22,
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 36,
                color: colors.warmWhite,
                letterSpacing: -0.8,
              }}
            >
              {t("subscribe.price")}
            </Text>
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {t("subscribe.perMonth")}
            </Text>
          </View>
        </View>

        {/* Benefits */}
        <View style={{ marginTop: 28, paddingHorizontal: 20, gap: 12 }}>
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <View
                key={b.id}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    backgroundColor: colors.tagUserBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={colors.navy} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FONT.semibold,
                      fontSize: 15,
                      color: colors.navy,
                    }}
                  >
                    {t(b.titleKey)}
                  </Text>
                  <Text
                    style={{
                      marginTop: 3,
                      fontFamily: FONT.regular,
                      fontSize: 13,
                      lineHeight: 19,
                      color: colors.midGrey,
                    }}
                  >
                    {t(b.bodyKey)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* CTA */}
        <View style={{ marginTop: 32, paddingHorizontal: 20, gap: 12 }}>
          <PrimaryButton
            label={t("subscribe.continueOnWebsite")}
            loading={opening}
            onPress={openCheckout}
          />
          <GhostButton
            label={t("subscribe.maybeLater")}
            onPress={() => router.back()}
            variant="link"
          />
        </View>

        <Text
          style={{
            textAlign: "center",
            marginTop: 18,
            paddingHorizontal: 28,
            fontFamily: FONT.regular,
            fontSize: 11.5,
            lineHeight: 17,
            color: colors.midGrey,
          }}
        >
          {t("subscribe.paymentNote")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
