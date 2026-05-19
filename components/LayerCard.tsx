import { Pressable, Text, View } from "react-native";
import { ChevronRight, Radar, Repeat, Target, type LucideIcon } from "lucide-react-native";
import { FONT, colors, layer, type LayerKey } from "@/theme/tokens";

type Props = {
  layerKey: LayerKey;
  items: number;
  subtitle: string;
  onPress?: () => void;
};

const ICONS: Record<LayerKey, LucideIcon> = {
  scan: Radar,
  reinforcement: Repeat,
  focus: Target,
};

/**
 * The recommended-flow row on Today (and onboarding's intro list).
 * Color stripe on the left, layer icon, label + item count + sub-line.
 */
export function LayerCard({ layerKey, items, subtitle, onPress }: Props) {
  const { color, label } = layer[layerKey];
  const Icon = ICONS[layerKey];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} layer, ${items} items, ${subtitle}`}
      className="flex-row items-center overflow-hidden rounded-card bg-surface"
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: colors.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 4, alignSelf: "stretch", backgroundColor: color }} />
      <View
        className="flex-row items-center"
        style={{
          paddingLeft: 14,
          paddingRight: 14,
          paddingVertical: 16,
          flex: 1,
          gap: 14,
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.9} />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-baseline" style={{ gap: 8 }}>
            <Text
              className="text-navy"
              style={{ fontFamily: FONT.semibold, fontSize: 16, letterSpacing: -0.16 }}
            >
              {label}
            </Text>
            <Text
              className="text-caption text-mid-grey"
              style={{ fontFamily: FONT.regular, fontVariant: ["tabular-nums"] }}
            >
              {items} items
            </Text>
          </View>
          <Text
            className="mt-0.5 text-caption text-mid-grey"
            style={{ fontFamily: FONT.regular }}
          >
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color="#C0BEB8" strokeWidth={1.9} />
      </View>
    </Pressable>
  );
}
