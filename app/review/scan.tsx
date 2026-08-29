import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { DeckErrorScreen } from "@/components/DeckErrorScreen";
import { MascotLoader } from "@/components/MascotLoader";
import { ReviewHeader } from "@/components/ReviewHeader";
import { FolderPill } from "@/components/FolderPill";
import { Tappable } from "@/components/Tappable";
import { AMEND_WINDOW_MS, useReviewStore } from "@/lib/review-store";
import { success, tap } from "@/lib/feedback";
import { useT } from "@/lib/i18n";
import { FONT, colors, layerTint, radii } from "@/theme/tokens";

export default function ScanScreen() {
  const { t } = useT();
  const ensureSession = useReviewStore((s) => s.ensureSession);
  // Never call s.cards() inside the selector: folder-scoped decks are
  // rebuilt via filter() on every call, and an ever-new snapshot sends
  // zustand v5 / useSyncExternalStore into an infinite re-render loop
  // ("Maximum update depth exceeded") the moment a folder's "Ripassa ora"
  // starts a session. Select the stable inputs and memoize the deck.
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
  const amendLastAnswer = useReviewStore((s) => s.amendLastAnswer);
  const [revealed, setRevealed] = useState(false);
  // Carte con lettura (giapponese): la lettura NON è visibile all'inizio.
  // Primo tap = "Mostrami la lettura", secondo = "Mostrami il significato"
  // (Angelo, 2026-08-27). Vedere la sola lettura non conta come reveal per
  // lo scheduler: solo il significato conta come "non ricordato".
  const [readingShown, setReadingShown] = useState(false);
  // Frase d'esempio: passo intermedio dello stesso bottone ("Mostra
  // esempio"), PRIMA del significato — è un aiuto, non la risposta
  // (Angelo, 2026-08-27). Solo per le carte che ne hanno una.
  const [exampleShown, setExampleShown] = useState(false);
  // Flash di conferma dopo "Lo ricordo": mostra la soluzione della carta
  // appena risposta per la finestra di amend, poi prosegue.
  const [flash, setFlash] = useState<null | {
    front: string;
    reading?: string;
    back: string;
    amended: boolean;
  }>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Today calls start(layer, mode) explicitly before navigating here, so
  // this effect is the defensive fallback for unusual entry paths (deep
  // links, app restore on this route, back-gesture refocus). Scan is the
  // documented entry point of the full Scan → Reinforcement → Focus flow,
  // so the fallback opens flow mode — Today's prior start("scan","single")
  // is preserved because ensureSession no-ops once it sees an open or
  // pending session for the same layer.
  useFocusEffect(
    useCallback(() => {
      ensureSession("scan", "flow");
      setRevealed(false);
      setReadingShown(false);
      setExampleShown(false);
    }, [ensureSession]),
  );

  useEffect(() => {
    setRevealed(false);
    setReadingShown(false);
    setExampleShown(false);
  }, [index]);

  // Il timer del flash non deve sopravvivere allo screen.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // Livello senza carte dentro un flusso (es. la coda vera è vuota per
  // questo livello): salta avanti invece di strandare l'utente. Lo stato
  // vuoto con "Torna indietro" resta per le sessioni single.
  useEffect(() => {
    if (deckLoading || deckError || cards.length > 0 || mode !== "flow") return;
    router.replace("/review/handoff");
  }, [deckLoading, deckError, cards.length, mode]);

  const card = cards[index];

  const routeAfter = (result: "next" | "handoff" | "done") => {
    if (result === "handoff") router.replace("/review/handoff");
    else if (result === "done") router.replace("/review/complete");
  };

  const handleRemember = () => {
    // If the user already revealed the meaning they did not recall it:
    // binary answer, logged as "forgot" (Scan "show me" → SM-2 quality 2
    // per docs/SRS.md). A pure "remembered" tap (no reveal) keeps quality 4.
    if (revealed) {
      tap();
      routeAfter(recordAndAdvance("forgot", { revealed: true }));
      return;
    }
    success();
    const front = card.front;
    const reading = card.reading;
    const back = card.back;
    const result = recordAndAdvance("remembered", { revealed: false });
    // Flash di conferma: la soluzione resta visibile per la finestra di
    // amend; la navigazione di fine mazzo aspetta la chiusura del flash.
    setFlash({ front, reading, back, amended: false });
    flashTimer.current = setTimeout(() => {
      setFlash(null);
      routeAfter(result);
    }, AMEND_WINDOW_MS);
  };

  const handleAmend = () => {
    if (!flash || flash.amended) return;
    if (amendLastAnswer()) {
      tap();
      setFlash({ ...flash, amended: true });
    }
  };

  const hasReading = Boolean(card?.reading);
  const hasExample = Boolean(card?.example);
  // One secondary button that steps through what the card can show:
  // reading (Japanese) → example → meaning. Disabled once the meaning is out.
  const handleShowMe = () => {
    tap();
    if (hasReading && !readingShown) {
      setReadingShown(true);
      return;
    }
    if (hasExample && !exampleShown) {
      setExampleShown(true);
      return;
    }
    setRevealed(true);
  };
  const showMeDisabled = revealed;
  const showMeLabel =
    hasReading && !readingShown
      ? t("scan.showMeReading")
      : hasExample && !exampleShown
        ? t("scan.showExample")
        : hasReading || hasExample
          ? t("scan.showMeMeaning")
          : t("scan.showMe");

  // Flash di conferma — sostituisce interamente la carta (regge anche
  // sull'ultima carta del mazzo, quando l'indice è già oltre la fine).
  if (flash) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <ReviewHeader
          layerKey="scan"
          index={Math.min(index, Math.max(cards.length - 1, 0))}
          total={cards.length}
        />
        <Pressable
          onPress={handleAmend}
          accessibilityRole="button"
          accessibilityLabel={
            flash.amended
              ? t("scan.markedToReviewA11y")
              : t("scan.amendA11y")
          }
          style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 48 }}
        >
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontFamily: FONT.bold,
              fontSize: flash.front.length > 10 ? 40 : 56,
              color: colors.navy,
              letterSpacing: -1.4,
              textAlign: "center",
              lineHeight: flash.front.length > 10 ? 46 : 62,
              paddingHorizontal: 8,
            }}
          >
            {flash.front}
          </Text>
          {flash.reading ? (
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 18,
                color: colors.midGrey,
                marginTop: 10,
                letterSpacing: 0.2,
              }}
            >
              {flash.reading}
            </Text>
          ) : null}
          <View
            style={{
              backgroundColor: layerTint.scanReveal,
              paddingHorizontal: 20,
              paddingVertical: 18,
              marginTop: 30,
              alignSelf: "stretch",
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 19,
                color: colors.navy,
                lineHeight: 26,
                letterSpacing: -0.1,
              }}
            >
              {flash.back}
            </Text>
          </View>
          <Text
            style={{
              marginTop: 16,
              fontFamily: flash.amended ? FONT.semibold : FONT.regular,
              fontSize: 13,
              color: flash.amended ? colors.navy : colors.midGrey,
              textAlign: "center",
            }}
          >
            {flash.amended
              ? t("scan.markedToReview")
              : t("scan.amendHint")}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Mazzo non caricato (rete / timeout / RLS): errore con "Riprova". Mai
  // trattarlo come livello vuoto — in un flusso salterebbe al recap con 0
  // carte senza che l'utente capisca cosa sia successo.
  if (deckError) return <DeckErrorScreen onRetry={retryDeckLoad} />;

  // Mazzo in caricamento dal DB — o livello vuoto in un flusso (l'effetto
  // sopra sta già navigando avanti): mostra l'attesa, non lo stato vuoto.
  if (deckLoading || (mode === "flow" && cards.length === 0)) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("scan.preparingReview")} />
        </View>
      </SafeAreaView>
    );
  }

  // Empty deck — e.g. a folder-scoped session whose folder has no due
  // cards, or a stale deep link. Offer a way back instead of a blank screen.
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
            {t("scan.emptyDeck")}
          </Text>
          <Tappable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("scan.goBack")}
            pressedOpacity={0.88}
            containerStyle={{ marginTop: 24 }}
            style={{
              height: 48,
              paddingHorizontal: 28,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.navy,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: colors.warmWhite }}>
              {t("scan.goBack")}
            </Text>
          </Tappable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ReviewHeader layerKey="scan" index={index} total={cards.length} />

      <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 48 }}>
        <FolderPill folder={card.folder} layerKey="scan" />

        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontFamily: FONT.bold,
            fontSize: card.front.length > 10 ? 56 : 84,
            color: colors.navy,
            letterSpacing: -2.4,
            textAlign: "center",
            lineHeight: card.front.length > 10 ? 64 : 92,
            marginTop: 24,
            paddingHorizontal: 8,
          }}
        >
          {card.front}
        </Text>
        {card.reading && readingShown ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 21,
              color: colors.midGrey,
              marginTop: 14,
              letterSpacing: 0.2,
            }}
          >
            {card.reading}
          </Text>
        ) : null}

        {exampleShown && card.example ? (
          <Text
            style={{
              marginTop: 22,
              paddingHorizontal: 12,
              fontFamily: FONT.regular,
              fontSize: 16.5,
              lineHeight: 24,
              fontStyle: "italic",
              color: colors.navySoft,
              textAlign: "center",
            }}
          >
            {card.example}
          </Text>
        ) : null}

        {revealed ? (
          <View
            style={{
              backgroundColor: layerTint.scanReveal,
              paddingHorizontal: 20,
              paddingVertical: 18,
              marginTop: 36,
              alignSelf: "stretch",
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 19,
                color: colors.navy,
                lineHeight: 26,
                letterSpacing: -0.1,
              }}
            >
              {card.back}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, gap: 12 }}>
        <Tappable
          onPress={handleShowMe}
          disabled={showMeDisabled}
          accessibilityRole="button"
          accessibilityLabel={showMeLabel}
          pressedOpacity={0.85}
          style={{
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.cta,
            height: 56,
            borderWidth: 1.5,
            borderColor: showMeDisabled ? colors.divider : colors.scan,
            backgroundColor: colors.warmWhite,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 18,
              color: showMeDisabled ? colors.midGrey : colors.scan,
              letterSpacing: -0.1,
            }}
          >
            {showMeLabel}
          </Text>
        </Tappable>
        <Tappable
          onPress={handleRemember}
          accessibilityRole="button"
          accessibilityLabel={revealed ? t("scan.continueAfterRevealA11y") : t("scan.iRemember")}
          pressedOpacity={0.88}
          style={{
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.cta,
            height: 60,
            backgroundColor: colors.scan,
            borderWidth: 0,
            shadowColor: colors.scan,
            shadowOpacity: 0.5,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 20,
            elevation: 5,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 19,
              color: colors.warmWhite,
              letterSpacing: -0.16,
            }}
          >
            {revealed ? t("common.continue") : t("scan.iRemember")}
          </Text>
        </Tappable>
      </View>
    </SafeAreaView>
  );
}
