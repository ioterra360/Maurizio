import { PixelRatio, Text, useWindowDimensions, type StyleProp, type TextStyle } from "react-native";

import { termFontSize, termLetterSpacing, termLineHeight, termLines } from "@/lib/term-typography";
import { FONT, colors } from "@/theme/tokens";

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

/**
 * The big term on the review screens. Sized from the string and the screen
 * width (lib/term-typography.ts) so long words fit instead of clipping at
 * six letters; single words stay on one line, multi-word terms may wrap to
 * two (up to four for a long phrase at the floor). adjustsFontSizeToFit
 * stays on as a safety net only.
 */
export function TermText({ text, max, screenPadding, style }: Props) {
  const { width } = useWindowDimensions();
  const fontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_MULTIPLIER);
  const box = (width - 2 * screenPadding - 2 * TEXT_PADDING) / Math.max(1, fontScale);
  const size = termFontSize(text, box, max);
  const lines = termLines(text, box, size);
  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={lines}
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
