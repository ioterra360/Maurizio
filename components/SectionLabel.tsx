import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  children: string;
  /** When true, renders the label bracketed by hairlines (editorial divider). */
  bracketed?: boolean;
  /** Optional top margin to space sections apart. */
  topMargin?: number;
};

/**
 * The ALL-CAPS, letter-spaced mid-grey label that delineates sections.
 * The "DEMO ACCOUNTS" / "RECOMMENDED FLOW" pattern.
 */
export function SectionLabel({ children, bracketed = false, topMargin = 0 }: Props) {
  if (bracketed) {
    return (
      <View
        className="flex-row items-center"
        style={{ marginTop: topMargin, gap: 10 }}
      >
        <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
        <Text
          className="text-xs-tight text-mid-grey"
          style={{ fontFamily: FONT.bold, textTransform: "uppercase" }}
        >
          {children}
        </Text>
        <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
      </View>
    );
  }
  return (
    <Text
      className="text-xs-tight text-mid-grey"
      style={{
        fontFamily: FONT.semibold,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginTop: topMargin,
      }}
    >
      {children}
    </Text>
  );
}
