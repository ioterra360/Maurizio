import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  dot: string;
  label: string;
  count: number;
  pct: number;
};

/**
 * The labelled count block used in the Folder detail stats card and on the
 * Memory Health screen. Dot + ALL-CAPS label, then big number + percentage.
 */
export function StatBlock({ dot, label, count, pct }: Props) {
  return (
    <View style={{ gap: 4 }}>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dot }}
        />
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11.5,
            color: colors.midGrey,
            letterSpacing: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline" style={{ gap: 5 }}>
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 22,
            color: colors.navy,
            letterSpacing: -0.5,
            fontVariant: ["tabular-nums"],
            lineHeight: 24,
          }}
        >
          {count}
        </Text>
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 12,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {pct}%
        </Text>
      </View>
    </View>
  );
}
