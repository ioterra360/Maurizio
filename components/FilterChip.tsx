import { Text, View } from "react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";

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
    <Tappable
      onPress={onPress}
      accessibilityLabel={`Filtro ${label}, ${count} ricordi`}
      accessibilityState={{ selected: active }}
      pressedOpacity={0.6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.filter,
        height: 32,
        paddingHorizontal: 12,
        gap: 7,
        backgroundColor: active ? colors.navy : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: colors.hairline,
      }}
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
          fontSize: 13.5,
          color: active ? colors.warmWhite : colors.navy,
          letterSpacing: -0.07,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 12,
          color: active ? "rgba(250,248,244,0.78)" : colors.midGrey,
          fontVariant: ["tabular-nums"],
        }}
      >
        {count}
      </Text>
    </Tappable>
  );
}
