import { View, type DimensionValue } from "react-native";
import { colors } from "@/theme/tokens";

type Props = {
  active: number;
  fading: number;
  archived: number;
  width?: DimensionValue;
  height?: number;
};

/**
 * The horizontal segmented bar that shows a folder's memory health.
 * Order is fixed: active (green) → fading (peach) → archived (grey).
 * Values are percentages summing to ~100.
 */
export function RetentionBar({
  active,
  fading,
  archived,
  width = 96,
  height = 8,
}: Props) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Memory health: ${active}% active, ${fading}% fading, ${archived}% archived`}
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: colors.divider,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <View style={{ flex: active, backgroundColor: colors.active }} />
      <View style={{ flex: fading, backgroundColor: colors.fading }} />
      <View style={{ flex: archived, backgroundColor: colors.archived }} />
    </View>
  );
}
