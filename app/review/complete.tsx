import { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionLabel } from "@/components/SectionLabel";
import { useReviewStore, type RecapEntry } from "@/lib/review-store";
import { success } from "@/lib/feedback";
import { FONT, colors, layer as layerTokens, statusTint, type LayerKey } from "@/theme/tokens";

/**
 * Recap di fine sessione (spec core-loop §7): mascotte animata, messaggio a
 * fasce di risultato, barre degli esiti, breakdown per livello (flow) e la
 * lista carta per carta. Colori esito = status ink del design system, sempre
 * accompagnati da etichetta testuale (mai identità dal solo colore).
 */

type Outcome = RecapEntry["response"];

const OUTCOME_COLOR: Record<Outcome, string> = {
  remembered: statusTint.active.text,
  struggled: colors.navy,
  forgot: statusTint.fading.text,
};

const OUTCOME_LABEL: Record<Outcome, string> = {
  remembered: "Ricordato",
  struggled: "Difficile",
  forgot: "Dimenticato",
};

const TIER_COPY = {
  top: {
    title: "Sessione brillante!",
    body: "La tua memoria di lungo termine ringrazia. Torna domani per consolidare.",
  },
  mid: {
    title: "Buon lavoro, si costruisce così.",
    body: "Qualche ricordo ha avuto bisogno di una mano — è esattamente ciò che serve all'algoritmo per aiutarti.",
  },
  low: {
    title: "Giornata dura? Va benissimo.",
    body: "Dimenticare fa parte del processo: questi ricordi torneranno presto e saranno più leggeri.",
  },
} as const;

function AnimatedMascot() {
  const enter = useSharedValue(0);
  const wobble = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 12, stiffness: 120 });
    wobble.value = withDelay(
      600,
      withRepeat(
        withSequence(withTiming(1, { duration: 1400 }), withTiming(-1, { duration: 1400 })),
        -1,
        true,
      ),
    );
  }, [enter, wobble]);
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: 0.6 + enter.value * 0.4 },
      { translateY: (1 - enter.value) * 24 },
      { rotate: `${wobble.value * 3}deg` },
    ],
  }));
  return (
    <Animated.View style={style}>
      <Mascot variant="checklist" size={170} withShadow={false} />
    </Animated.View>
  );
}

/** Barra orizzontale di un esito: pallino + etichetta + track/fill + conteggio. */
function OutcomeBar({
  outcome,
  value,
  max,
}: {
  outcome: Outcome;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View className="flex-row items-center" style={{ gap: 10, paddingVertical: 6 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: OUTCOME_COLOR[outcome],
        }}
      />
      <Text
        style={{
          width: 92,
          fontFamily: FONT.medium,
          fontSize: 13,
          color: colors.midGrey,
          letterSpacing: -0.05,
        }}
      >
        {OUTCOME_LABEL[outcome]}
      </Text>
      <View
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.divider,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: OUTCOME_COLOR[outcome],
          }}
        />
      </View>
      <Text
        style={{
          width: 26,
          textAlign: "right",
          fontFamily: FONT.semibold,
          fontSize: 14,
          color: colors.navy,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CompleteScreen() {
  const totals = useReviewStore((s) => s.totals);
  const results = useReviewStore((s) => s.results);
  const mode = useReviewStore((s) => s.mode);
  const reset = useReviewStore((s) => s.reset);

  const total = totals.reviewed || results.length;
  const pct = total > 0 ? totals.remembered / total : 0;
  const tier = pct >= 0.8 ? "top" : pct >= 0.5 ? "mid" : "low";
  const copy = TIER_COPY[tier];
  const maxOutcome = Math.max(totals.remembered, totals.struggled, totals.forgot, 1);

  // Breakdown per livello — solo in flow, dove i livelli sono più di uno.
  const byLayer = useMemo(() => {
    const acc = new Map<LayerKey, { remembered: number; struggled: number; forgot: number }>();
    for (const r of results) {
      const c = acc.get(r.layer) ?? { remembered: 0, struggled: 0, forgot: 0 };
      c[r.response] += 1;
      acc.set(r.layer, c);
    }
    return acc;
  }, [results]);

  // Celebratory cue on landing — once per mount.
  useEffect(() => {
    success();
  }, []);

  const goHome = () => {
    reset();
    router.replace("/(app)/today");
  };

  if (total === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
          <AnimatedMascot />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 26,
              color: colors.navy,
              letterSpacing: -0.7,
              textAlign: "center",
              lineHeight: 32,
              marginTop: 12,
            }}
          >
            Niente da ripassare, per ora.
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 15.5,
              color: colors.midGrey,
              marginTop: 12,
              lineHeight: 23,
              maxWidth: 300,
              textAlign: "center",
            }}
          >
            La tua coda è vuota — aggiungi nuovi ricordi o torna più tardi.
          </Text>
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
          <PrimaryButton label="Torna a Oggi" onPress={goHome} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", paddingHorizontal: 28, paddingTop: 26 }}>
          <AnimatedMascot />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 29,
              color: colors.navy,
              letterSpacing: -0.85,
              textAlign: "center",
              lineHeight: 35,
              marginTop: 12,
            }}
          >
            {mode === "single" ? "Sessione completata!" : copy.title}
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 15.5,
              color: colors.midGrey,
              marginTop: 12,
              lineHeight: 23,
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            {copy.body}
          </Text>
        </View>

        {/* Esiti della sessione */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 6 }}>
          <SectionLabel>Come è andata</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <OutcomeBar outcome="remembered" value={totals.remembered} max={maxOutcome} />
            <OutcomeBar outcome="struggled" value={totals.struggled} max={maxOutcome} />
            <OutcomeBar outcome="forgot" value={totals.forgot} max={maxOutcome} />
            <Text
              style={{
                marginTop: 10,
                fontFamily: FONT.regular,
                fontSize: 12.5,
                color: colors.midGrey,
                fontVariant: ["tabular-nums"],
              }}
            >
              {total} ricordi ripassati
              {mode === "flow" && byLayer.size > 1 ? " · tre livelli" : ""}
            </Text>
          </View>
        </View>

        {/* Breakdown per livello — solo flow */}
        {mode === "flow" && byLayer.size > 1 ? (
          <>
            <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 6 }}>
              <SectionLabel>Per livello</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              <View
                className="rounded-card bg-surface"
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                {(["scan", "reinforcement", "focus"] as LayerKey[]).map((l) => {
                  const c = byLayer.get(l);
                  if (!c) return null;
                  return (
                    <View
                      key={l}
                      className="flex-row items-center"
                      style={{ paddingVertical: 9, gap: 8 }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: layerTokens[l].color,
                        }}
                      />
                      <Text
                        style={{
                          width: 118,
                          fontFamily: FONT.semibold,
                          fontSize: 13.5,
                          color: colors.navy,
                          letterSpacing: -0.05,
                        }}
                      >
                        {layerTokens[l].label}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: FONT.regular,
                          fontSize: 12.5,
                          color: colors.midGrey,
                          fontVariant: ["tabular-nums"],
                        }}
                        numberOfLines={1}
                      >
                        {c.remembered} ricordati · {c.struggled} difficili · {c.forgot} dimenticati
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {/* Carta per carta */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 6 }}>
          <SectionLabel>Carta per carta</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            {results.map((r, i) => (
              <View
                key={`${r.id}-${r.layer}-${i}`}
                className="flex-row items-center"
                style={{
                  paddingVertical: 9,
                  gap: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.divider,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: OUTCOME_COLOR[r.response],
                  }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: FONT.semibold,
                      fontSize: 15,
                      color: colors.navy,
                      letterSpacing: -0.1,
                    }}
                  >
                    {r.term}
                    {r.reading ? `  ·  ${r.reading}` : ""}
                  </Text>
                </View>
                {r.revealed ? (
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 11.5,
                      color: colors.midGrey,
                    }}
                  >
                    Mostrami
                  </Text>
                ) : null}
                <Text
                  style={{
                    fontFamily: FONT.medium,
                    fontSize: 12.5,
                    color: colors.midGrey,
                  }}
                >
                  {OUTCOME_LABEL[r.response]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 28 }}>
          <PrimaryButton label="Torna a Oggi" onPress={goHome} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
