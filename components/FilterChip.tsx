import { Pressable, Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  label: string;
  count: number;
  active?: boolean;
  dot?: string;
  onPress?: () => void;
};

/**
 * Filter chip with inline count, used on the Folder detail "All / Active /
 * Fading / Archived" toggle row.
 */
export function FilterChip({ label, count, active, dot, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter ${label}, ${count} items`}
      accessibilityState={{ selected: active }}
      className="flex-row items-center rounded-filter"
      style={({ pressed }) => ({
        height: 32,
        paddingHorizontal: 12,
        gap: 7,
        backgroundColor: active ? colors.navy : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: colors.hairline,
        opacity: pressed && !active ? 0.6 : 1,
      })}
    >
      {dot ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: dot,
            opacity: active ? 0.85 : 1,
          }}
        />
      ) : null}
      <Text
        style={{
          fontFamily: active ? FONT.semibold : FONT.medium,
          fontSize: 13,
          color: active ? "#fff" : colors.navy,
          letterSpacing: -0.07,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11.5,
          color: active ? "rgba(255,255,255,0.7)" : colors.midGrey,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}
