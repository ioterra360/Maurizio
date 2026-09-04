import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { DeckErrorScreen } from "@/components/DeckErrorScreen";
import { MascotLoader } from "@/components/MascotLoader";
import { MemoryPhoto } from "@/components/MemoryPhoto";
import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { TermText } from "@/components/TermText";
import { RecallButton } from "@/components/RecallButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useReviewStore } from "@/lib/review-store";
import { useT } from "@/lib/i18n";
import { success, error } from "@/lib/feedback";
import { FONT, useColors } from "@/theme/tokens";

export default function FocusScreen() {
  const colors = useColors();
  const { t } = useT();
  // Android edge-to-edge (app.json edgeToEdgeEnabled): senza il bottom
  // inset il CTA finisce sotto la barra di sistema a 3 pulsanti (~48dp).
  // Maurizio 2026-09-01. Pattern canonico: (app)/_layout.tsx.
  const insets = useSafeAreaInsets();
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
  const [revealed, setRevealed] = useState(false);
  // La colonna della carta scorre (vedi lo ScrollView sotto): il ref serve a
  // rimetterla in cima a ogni carta nuova e a portare in vista la risposta
  // appena rivelata.
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      // No-op when arriving from a flow handoff; opens a single-layer
      // session when Today routed us here directly.
      ensureSession("focus", "single");
      setRevealed(false);
    }, [ensureSession]),
  );

  // Hide the answer again whenever the deck advances to the next card.
  useEffect(() => {
    setRevealed(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  // Livello vuoto dentro un flusso: chiudi direttamente sul recap.
  useEffect(() => {
    if (deckLoading || deckError || cards.length > 0 || mode !== "flow") return;
    router.replace("/review/complete");
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
          <MascotLoader label={t("focus.preparingReview")} />
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
            {t("focus.emptyDeck")}
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 24 }}>
            <PrimaryButton label={t("focus.goBack")} onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const advance = (response: "remembered" | "forgot") => {
    // Binary answer (Maurizio, 2026-08-29): success cue on a recall, error
    // cue on a forget. RecallButton keeps a "struggled" variant for when the
    // intermediate answer returns with its own timing.
    if (response === "remembered") success();
    else error();
    const result = recordAndAdvance(response);
    if (result === "done") router.replace("/review/complete");
  };

  // La risposta (e la foto, quando l'URL firmato arriva) allunga la colonna
  // in fondo: se esce dallo schermo va portata in vista, altrimenti il tap su
  // "Mostra risposta" sembra non aver fatto nulla.
  const keepRevealedInView = () => {
    if (revealed) scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="focus" index={index} total={cards.length} />

      {/* La colonna scorre: il pannello rivelato puo' superare l'altezza
          libera (termine lungo + lettura + esempio + foto 4:3) e in RN i figli
          non si stringono, quindi senza ScrollView finirebbe tagliato o sotto
          i bottoni. flexGrow 1 lascia il layout identico quando ci sta. */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 22,
          paddingTop: 28,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={keepRevealedInView}
      >
        <View style={{ alignItems: "center" }}>
          <FolderPill folder={card.folder} layerKey="focus" />
        </View>

        <TermText text={card.front} max={80} screenPadding={22} style={{ marginTop: 24 }} />
        {card.reading ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 16,
              color: colors.midGrey,
              marginTop: 12,
              letterSpacing: 0.2,
              textAlign: "center",
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {revealed ? (
          <View
            className="rounded-card"
            style={{
              backgroundColor: colors.divider,
              paddingHorizontal: 18,
              paddingVertical: 16,
              marginTop: 36,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 17,
                color: colors.navy,
                lineHeight: 24,
                letterSpacing: -0.15,
              }}
            >
              {card.back}
            </Text>
            {card.example ? (
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: FONT.regular,
                  fontSize: 14,
                  fontStyle: "italic",
                  color: colors.navySoft,
                  lineHeight: 20,
                }}
              >
                {card.example}
              </Text>
            ) : null}
            {card.photoPath ? <MemoryPhoto path={card.photoPath} style={{ marginTop: 14 }} /> : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Recall buttons appear only after the answer is revealed — Focus is
          active recall, so the answer stays hidden until the user commits. */}
      <View style={{ paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom, 32), gap: 10 }}>
        {revealed ? (
          <>
            <RecallButton variant="forgot" onPress={() => advance("forgot")} />
            <RecallButton variant="remembered" onPress={() => advance("remembered")} />
          </>
        ) : (
          <PrimaryButton label={t("focus.showAnswer")} onPress={() => setRevealed(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}
