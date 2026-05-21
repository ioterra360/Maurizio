import { useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Mascot, type MascotVariant } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { colors, FONT, layerTint } from "@/theme/tokens";

const { width: SCREEN_W } = Dimensions.get("window");

type Step = {
  key: string;
  mascot: MascotVariant;
  haloBg: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    key: "welcome",
    mascot: "default",
    haloBg: colors.warmWhite,
    title: "Benvenuto in Memika",
    body: "La tua memoria, ben curata. Tre ritmi di ripasso che lavorano insieme per te.",
  },
  {
    key: "scan",
    mascot: "investigate",
    haloBg: layerTint.scan,
    title: "Scan",
    body: "Una rapida occhiata ai ricordi più vecchi: pochi secondi, tanta consapevolezza.",
  },
  {
    key: "reinforcement",
    mascot: "checklist",
    haloBg: layerTint.reinforcement,
    title: "Reinforcement",
    body: "Consolidi quello che hai visto negli ultimi giorni. Più rifletti, più si fissa.",
  },
  {
    key: "focus",
    mascot: "idea",
    haloBg: layerTint.focus,
    title: "Focus",
    body: "Lavoro profondo sui ricordi di ieri. Qui la memoria diventa duratura.",
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== step) setStep(idx);
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      scrollRef.current?.scrollTo({ x: (step + 1) * SCREEN_W, animated: true });
    } else {
      router.replace("/(auth)/login" as never);
    }
  };

  const skip = () => router.replace("/(auth)/login" as never);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      {/* Top bar — Skip */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 8,
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={skip}
          accessibilityRole="link"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 13,
              color: colors.midGrey,
              letterSpacing: 0.2,
            }}
          >
            Salta
          </Text>
        </Pressable>
      </View>

      {/* Steps */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {STEPS.map((s) => (
          <View
            key={s.key}
            style={{
              width: SCREEN_W,
              paddingHorizontal: 32,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Soft halo behind the mascot — layer-tinted to telegraph the step */}
            <View
              style={{
                width: 200,
                height: 200,
                borderRadius: 999,
                backgroundColor: s.haloBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mascot variant={s.mascot} size={170} withShadow={false} />
            </View>

            <Text
              style={{
                marginTop: 36,
                fontFamily: FONT.bold,
                fontSize: 28,
                lineHeight: 34,
                letterSpacing: -0.5,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {s.title}
            </Text>
            <Text
              style={{
                marginTop: 14,
                fontFamily: FONT.regular,
                fontSize: 15.5,
                lineHeight: 24,
                color: colors.midGrey,
                textAlign: "center",
                maxWidth: 320,
              }}
            >
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots + CTA */}
      <View style={{ paddingHorizontal: 28, paddingBottom: 28, gap: 22 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {STEPS.map((_, i) => {
            const on = i === step;
            return (
              <View
                key={i}
                style={{
                  width: on ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: on ? colors.navy : colors.hairlineStrong,
                }}
              />
            );
          })}
        </View>

        <PrimaryButton
          label={step === STEPS.length - 1 ? "Inizia ora" : "Continua"}
          onPress={goNext}
        />
        {step > 0 && step < STEPS.length - 1 ? (
          <GhostButton
            label="Salta l'introduzione"
            onPress={skip}
            variant="link"
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
