import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Sparkles } from "lucide-react-native";

import { DeckErrorScreen } from "@/components/DeckErrorScreen";
import { MascotLoader } from "@/components/MascotLoader";
import { MemoryPhoto } from "@/components/MemoryPhoto";
import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { TermText } from "@/components/TermText";
import { Tappable } from "@/components/Tappable";
import { useReviewStore } from "@/lib/review-store";
import { success, error, tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";
import { FONT, radii, useThemeTokens } from "@/theme/tokens";

type Stage = "pre" | "hint" | "answer";

export default function ReinforcementScreen() {
  // Android edge-to-edge (app.json edgeToEdgeEnabled): senza il bottom
  // inset il CTA finisce sotto la barra di sistema a 3 pulsanti (~48dp).
  // Maurizio 2026-09-01. Pattern canonico: (app)/_layout.tsx.
  const insets = useSafeAreaInsets();
  const { colors, statusTint } = useThemeTokens();
  const ensureSession = useReviewStore((s) => s.ensureSession);
  // s.cards() in the selector loops zustand v5 on folder-scoped decks —
  // see the note in review/scan.tsx.
  const layer = useReviewStore((s) => s.layer);
  const folderKind = useReviewStore((s) => s.folderKind);
  const deck = useReviewStore((s) => s.deck);
  const deckLoading = useReviewStore((s) => s.deckLoading);
  const deckError = useReviewStore((s) => s.deckError);
  const retryDeckLoad = useReviewStore((s) => s.retryDeckLoad);
  const mode = useReviewStore((s) => s.mode);
  const getCards = useReviewStore((s) => s.cards);
  const cards = useMemo(() => getCards(), [getCards, layer, folderKind, deck]);
  const index = useReviewStore((s) => s.index);
  const recordAndAdvance = useReviewStore((s) => s.recordAndAdvance);
  const [stage, setStage] = useState<Stage>("pre");
  // La colonna della carta scorre (vedi lo ScrollView sotto): il ref serve a
  // rimetterla in cima a ogni carta nuova e a portare in vista l'indizio o la
  // risposta appena rivelati.
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useT();

  useFocusEffect(
    useCallback(() => {
      // No-op when arriving from a flow handoff (sessionId is already open);
      // opens a single-layer session when Today routed us here directly.
      ensureSession("reinforcement", "single");
      setStage("pre");
    }, [ensureSession]),
  );

  useEffect(() => {
    setStage("pre");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  // Livello vuoto dentro un flusso: salta avanti (handoff decide se andare
  // a Focus o al recap) invece di strandare l'utente.
  useEffect(() => {
    if (deckLoading || deckError || cards.length > 0 || mode !== "flow") return;
    router.replace("/review/handoff");
  }, [deckLoading, deckError, cards.length, mode]);

  const card = cards[index];

  // Mazzo non caricato (rete / timeout / RLS): errore con "Riprova". Mai
  // trattarlo come livello vuoto — in un flusso salterebbe al recap con 0
  // carte senza che l'utente capisca cosa sia successo.
  if (deckError) return <DeckErrorScreen onRetry={retryDeckLoad} />;

  if (deckLoading || (mode === "flow" && cards.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("reinforcement.preparingReview")} />
        </View>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 18,
              color: colors.navy,
              lineHeight: 26,
              textAlign: "center",
            }}
          >
            {t("reinforcement.emptyDeck")}
          </Text>
          <Tappable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("reinforcement.goBack")}
            pressedOpacity={0.88}
            containerStyle={{ marginTop: 24 }}
            style={{
              height: 48,
              paddingHorizontal: 28,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accent,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: colors.onAccent }}>
              {t("reinforcement.goBack")}
            </Text>
          </Tappable>
        </View>
      </SafeAreaView>
    );
  }

  const advance = (response: "remembered" | "forgot") => {
    if (response === "forgot") error();
    else success();
    const result = recordAndAdvance(response);
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const reveal = (next: Stage) => {
    tap();
    setStage(next);
  };

  // Indizio, risposta e foto (quando l'URL firmato arriva) allungano la
  // colonna in fondo: se esce dallo schermo va portata in vista, altrimenti
  // il tap sembra non aver fatto nulla.
  const keepRevealedInView = () => {
    if (stage !== "pre") scrollRef.current?.scrollToEnd({ animated: true });
  };

  // Authored mnemonic hint when the card has one; otherwise derive the
  // first sense of a multi-sense back (ellipsis baked in — only a prefix is
  // a truncation). A single-sense back yields no hint at all, so the hint
  // can never leak the full answer.
  const senses = card.back.split(" · ");
  const hint =
    card.hint ?? (senses.length > 1 ? t("reinforcement.derivedHint", { sense: senses[0] }) : null);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="reinforcement" index={index} total={cards.length} />

      {/* La colonna scorre: il pannello della risposta puo' superare l'altezza
          libera (termine lungo + lettura + foto 4:3) e in RN i figli non si
          stringono, quindi senza ScrollView finirebbe tagliato o sotto i
          bottoni. flexGrow 1 lascia il layout identico quando ci sta. */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          alignItems: "center",
          paddingTop: 40,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={keepRevealedInView}
      >
        <FolderPill folder={card.folder} layerKey="reinforcement" />

        <TermText text={card.front} max={72} screenPadding={24} style={{ marginTop: 24 }} />
        {card.reading ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 16,
              color: colors.midGrey,
              marginTop: 12,
              letterSpacing: 0.2,
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {/* Hint card — sparkle + single-line hint, dashed violet border */}
        {stage === "hint" ? (
          <View
            className="flex-row items-center self-stretch"
            style={{
              marginTop: 32,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.reinforcement,
              borderStyle: "dashed",
              gap: 10,
            }}
          >
            <Sparkles size={18} color={colors.reinforcement} strokeWidth={1.8} />
            <Text
              style={{
                flex: 1,
                fontFamily: FONT.medium,
                fontSize: 15,
                color: colors.navy,
                lineHeight: 21,
                letterSpacing: -0.07,
              }}
            >
              {hint}
            </Text>
          </View>
        ) : null}

        {/* Answer panel */}
        {stage === "answer" ? (
          <View
            className="self-stretch rounded-card bg-surface"
            style={{
              marginTop: 32,
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 18,
                color: colors.navy,
                lineHeight: 24,
                letterSpacing: -0.2,
              }}
            >
              {card.back}
            </Text>
            {card.photoPath ? <MemoryPhoto path={card.photoPath} style={{ marginTop: 14 }} /> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 32), gap: 10 }}>
        {stage === "pre" ? (
          <>
            {/* No hint affordance when the card has nothing safe to show. */}
            {hint != null ? (
              <Tappable
                onPress={() => reveal("hint")}
                accessibilityRole="button"
                accessibilityLabel={t("reinforcement.giveMeHint")}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.cta,
                  height: 56,
                  borderWidth: 1.5,
                  borderColor: colors.hairlineStrong,
                  backgroundColor: colors.warmWhite,
                }}
              >
                <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: colors.navy }}>
                  {t("reinforcement.giveMeHint")}
                </Text>
              </Tappable>
            ) : null}
            <Tappable
              onPress={() => advance("remembered")}
              accessibilityRole="button"
              accessibilityLabel={t("reinforcement.continueRememberA11y")}
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.cta,
                height: 56,
                borderWidth: 1.5,
                borderColor: colors.navy,
                backgroundColor: colors.warmWhite,
              }}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: colors.navy }}>
                {t("common.continue")}
              </Text>
            </Tappable>
            <Tappable
              onPress={() => reveal("answer")}
              accessibilityRole="button"
              accessibilityLabel={t("reinforcement.showAnswer")}
              pressedOpacity={0.88}
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.cta,
                height: 60,
                backgroundColor: colors.reinforcement,
                borderWidth: 0,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 20,
                elevation: 5,
              }}
            >
              <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
                {t("reinforcement.showAnswer")}
              </Text>
            </Tappable>
          </>
        ) : null}

        {stage === "hint" ? (
          <Tappable
            onPress={() => reveal("answer")}
            accessibilityRole="button"
            accessibilityLabel={t("reinforcement.showAnswer")}
            pressedOpacity={0.88}
            style={{
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.cta,
              height: 60,
              backgroundColor: colors.reinforcement,
              borderWidth: 0,
              shadowColor: colors.reinforcement,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 20,
              elevation: 5,
            }}
          >
            <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
              {t("reinforcement.showAnswer")}
            </Text>
          </Tappable>
        ) : null}

        {stage === "answer" ? (
          <>
            <Tappable
              onPress={() => advance("forgot")}
              accessibilityRole="button"
              accessibilityLabel={t("reinforcement.reviewAgain")}
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.cta,
                height: 56,
                borderWidth: 1.5,
                borderColor: colors.fading,
                backgroundColor: colors.warmWhite,
              }}
            >
              <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: statusTint.fading.text }}>
                {t("reinforcement.reviewAgain")}
              </Text>
            </Tappable>
            <Tappable
              onPress={() => advance("remembered")}
              accessibilityRole="button"
              accessibilityLabel={t("reinforcement.continueRememberA11y")}
              pressedOpacity={0.88}
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.cta,
                height: 60,
                backgroundColor: colors.reinforcement,
                borderWidth: 0,
                shadowColor: colors.reinforcement,
                shadowOpacity: 0.5,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 20,
                elevation: 5,
              }}
            >
              <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.warmWhite, letterSpacing: -0.16 }}>
                {t("common.continue")}
              </Text>
            </Tappable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
