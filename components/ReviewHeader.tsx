import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Radar, Repeat, Target, type LucideIcon } from "lucide-react-native";
import { router } from "expo-router";
import { FONT, colors, layer as layerTokens, type LayerKey } from "@/theme/tokens";

const ICONS: Record<LayerKey, LucideIcon> = {
  scan: Radar,
  reinforcement: Repeat,
  focus: Target,
};

type Props = {
  layerKey: LayerKey;
  index: number;
  total: number;
};

/**
 * Shared header for the three review screens. Back chevron, progress dots
 * (extending the active one), and the layer label + icon on the right.
 */
export function ReviewHeader({ layerKey, index, total }: Props) {
  const { color, label } = layerTokens[layerKey];
  const Icon = ICONS[layerKey];

  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 }}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Exit review"
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
      </Pressable>

      <View className="flex-row" style={{ gap: 6, flex: 1, justifyContent: "center" }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i <= index ? color : "#DCDAD3",
            }}
          />
        ))}
      </View>

      <View className="flex-row items-center" style={{ gap: 6, width: 110, justifyContent: "flex-end" }}>
        <Icon size={14} color={color} strokeWidth={2.1} />
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 12.5,
            color: color,
            letterSpacing: -0.04,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
