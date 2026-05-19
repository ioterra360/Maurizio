import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  children: string;
  /** When true, renders the label bracketed by hairlines (editorial divider). */
  bracketed?: boolean;
  /** "default" 10.5/600/0.1em; "lg" 11/700/0.12em used on admin activity feeds. */
  size?: "default" | "lg";
  /** Optional top margin to space sections apart. */
  topMargin?: number;
};

/**
 * The ALL-CAPS, letter-spaced mid-grey label that delineates sections.
 * Calibrated against the mockup's actual letter-spacing values.
 *
 * - default: 10.5px / semibold / 0.1em (used on Today, Health, Settings,
 *   Folder detail, Admin home/insights/more)
 * - lg:      11px   / bold     / 0.12em (used on Admin "Activity" / "Retention" headers)
 *
 * Pass `bracketed` for the rare hairline-bracketed divider (login "DEMO
 * ACCOUNTS"), which renders at 0.14em — the wider tracking is intentional
 * for that one use.
 */
export function SectionLabel({ children, bracketed = false, size = "default", topMargin = 0 }: Props) {
  if (bracketed) {
    return (
      <View
        className="flex-row items-center"
        style={{ marginTop: topMargin, gap: 10 }}
      >
        <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 10.5,
            color: colors.midGrey,
            textTransform: "uppercase",
            letterSpacing: 1.47, // 0.14em on 10.5px
          }}
        >
          {children}
        </Text>
        <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
      </View>
    );
  }

  const tokens = size === "lg"
    ? { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1.32 }      // 0.12em on 11px
    : { fontFamily: FONT.semibold, fontSize: 10.5, letterSpacing: 1.05 }; // 0.1em on 10.5px

  return (
    <Text
      style={{
        ...tokens,
        color: colors.midGrey,
        textTransform: "uppercase",
        marginTop: topMargin,
      }}
    >
      {children}
    </Text>
  );
}
