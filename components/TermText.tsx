import { useEffect, useState } from "react";
import {
  type NativeSyntheticEvent,
  PixelRatio,
  Text,
  type TextLayoutEventData,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from "react-native";

import {
  FLOOR_SINGLE_WORD,
  termFontSize,
  termLetterSpacing,
  termLineHeight,
  termLines,
} from "@/lib/term-typography";
import { FONT, useColors } from "@/theme/tokens";

type Props = {
  text: string;
  /** Layer maximum in px (Scan 84, Focus 80, Reinforcement 72, Scan flash 56). */
  max: number;
  /** Horizontal padding of the screen container the term sits in. */
  screenPadding: number;
  style?: StyleProp<TextStyle>;
};

// Accessibility font scaling is honoured up to this multiplier; past it the
// term would not fit any screen, so the size is capped instead of clipped.
const MAX_FONT_MULTIPLIER = 1.3;
const TEXT_PADDING = 8;
/** Passo di riduzione quando il testo misurato non entra nelle righe previste. */
const SHRINK_STEP = 2;
/** Righe oltre le quali non si va: un termine di 50 caratteri a 24 px ci sta. */
const HARD_MAX_LINES = 4;

/**
 * The big term on the review screens.
 *
 * Il modello di lib/term-typography.ts sceglie la taglia dalla stringa e
 * dalla larghezza, e di norma azzecca. Ma la resa vera puo' sbordare di
 * qualche pixel (hinting, arrotondamenti del tracking, font scale) e
 * `adjustsFontSizeToFit` su Android a volte non rimpicciolisce affatto:
 * con `numberOfLines={1}` il risultato era il termine TRONCATO con i
 * puntini ("le parole lunghe non appaiono tutte", Angelo 7/9/2026).
 *
 * Ora il componente misura cio' che ha reso (onTextLayout) e corregge:
 * se le righe sono piu' di quelle previste, scende di taglia fino al
 * pavimento; se al pavimento ancora non entra, concede una riga in piu'.
 * Niente numberOfLines stretto e niente fitter nativo: il termine e'
 * SEMPRE intero, al massimo va a capo.
 */
export function TermText({ text, max, screenPadding, style }: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_MULTIPLIER);
  const box = (width - 2 * screenPadding - 2 * TEXT_PADDING) / Math.max(1, fontScale);
  const modelSize = termFontSize(text, box, max);
  const modelLines = termLines(text, box, modelSize);

  // Correzione dopo misura: si azzera quando cambiano testo o scatola.
  const [fit, setFit] = useState<{ size: number; lines: number } | null>(null);
  useEffect(() => {
    setFit(null);
  }, [text, box, max]);

  const size = fit?.size ?? modelSize;
  const lines = fit?.lines ?? modelLines;
  const isSingleWord = text.trim().split(/\s+/).filter(Boolean).length <= 1;
  const floor = isSingleWord ? FLOOR_SINGLE_WORD : Math.min(FLOOR_SINGLE_WORD + 4, modelSize);

  const onTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const rendered = e.nativeEvent.lines.length;
    if (rendered <= lines) return; // entra: niente da fare
    if (size - SHRINK_STEP >= floor) {
      setFit({ size: size - SHRINK_STEP, lines });
    } else if (lines < HARD_MAX_LINES) {
      // Al pavimento e ancora troppo largo: meglio a capo che troncato.
      setFit({ size, lines: lines + 1 });
    }
  };

  return (
    <Text
      // numberOfLines volutamente NON impostato: senza limite React Native
      // avvolge invece di troncare, e onTextLayout ci dice quante righe ha
      // usato. Il limite lo applichiamo noi, riducendo la taglia.
      onTextLayout={onTextLayout}
      maxFontSizeMultiplier={MAX_FONT_MULTIPLIER}
      style={[
        {
          fontFamily: FONT.bold,
          fontSize: size,
          lineHeight: termLineHeight(size),
          letterSpacing: termLetterSpacing(size),
          color: colors.navy,
          textAlign: "center",
          paddingHorizontal: TEXT_PADDING,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}
