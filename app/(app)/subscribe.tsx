import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft,
  Sparkles,
  Infinity as InfinityIcon,
  ShieldCheck,
  Radar,
} from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore } from "@/lib/auth-store";
import { colors, FONT } from "@/theme/tokens";

const CHECKOUT_URL = "https://memora.app/subscribe";

const BENEFITS = [
  {
    icon: InfinityIcon,
    title: "Ricordi illimitati",
    body: "Aggiungi tutto quello che vuoi memorizzare, senza limiti.",
  },
  {
    icon: Radar,
    title: "Scan / Reinforcement / Focus",
    body: "I tre ritmi di ripasso, sempre disponibili.",
  },
  {
    icon: Sparkles,
    title: "Insight personalizzati",
    body: "Suggerimenti su quando rivedere e dove rallentare.",
  },
  {
    icon: ShieldCheck,
    title: "Crittografia end-to-end",
    body: "I tuoi ricordi sono al sicuro, sempre.",
  },
];

export default function SubscribeScreen() {
  const userEmail = useAuthStore((s) => s.user?.email ?? "");
  const [opening, setOpening] = useState(false);

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
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Indietro"
            hitSlop={10}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Announce mascot — premium pitch lead */}
        <View style={{ alignItems: "center", marginTop: 4, marginBottom: -8 }}>
          <Mascot variant="announce" size={108} withShadow={false} />
        </View>

        {/* Hero — navy panel, warm-white inside (high contrast) */}
        <View
          style={{
            marginHorizontal: 20,
            marginTop: 12,
            borderRadius: 18,
            backgroundColor: colors.navy,
            padding: 24,
            shadowColor: colors.navy,
            shadowOpacity: 0.28,
            shadowOffset: { width: 0, height: 14 },
            shadowRadius: 30,
            elevation: 8,
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
              Memika Premium
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
            Sblocca la tua memoria,{"\n"}senza compromessi.
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
            Tre ritmi di ripasso, ricordi illimitati, insight personalizzati. Disdici quando vuoi.
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
              €4,99
            </Text>
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              / mese
            </Text>
          </View>
        </View>

        {/* Benefits */}
        <View style={{ marginTop: 28, paddingHorizontal: 20, gap: 12 }}>
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <View
                key={b.title}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  shadowColor: colors.navy,
                  shadowOpacity: 0.06,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 14,
                  elevation: 1,
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
                    {b.title}
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
                    {b.body}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* CTA */}
        <View style={{ marginTop: 32, paddingHorizontal: 20, gap: 12 }}>
          <PrimaryButton
            label="Continua sul sito"
            loading={opening}
            onPress={openCheckout}
          />
          <GhostButton
            label="Forse più tardi"
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
          Il pagamento avviene sul nostro sito web. Disdici quando vuoi dal tuo account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
