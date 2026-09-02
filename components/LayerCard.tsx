import { Text, View } from "react-native";
import { ChevronRight, Radar, Repeat, Target, type LucideIcon } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, radii, useThemeTokens, type LayerKey } from "@/theme/tokens";
import { useT } from "@/lib/i18n";

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
  const { t, tp } = useT();
  const { colors, layer } = useThemeTokens();
  const { color, label } = layer[layerKey];
  const Icon = ICONS[layerKey];

  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("layerCard.a11y", { label, items, subtitle })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View style={{ width: 4, alignSelf: "stretch", backgroundColor: color }} />
      <View
        className="flex-row items-center"
        style={{
          paddingLeft: 4,
          paddingRight: 14,
          paddingVertical: 16,
          flex: 1,
          gap: 12,
        }}
      >
        <Icon size={22} color={color} strokeWidth={1.9} />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-baseline" style={{ gap: 8 }}>
            <Text
              numberOfLines={1}
              className="text-navy"
              style={{ fontFamily: FONT.semibold, fontSize: 16, letterSpacing: -0.16, flexShrink: 1 }}
            >
              {label}
            </Text>
            <Text
              numberOfLines={1}
              className="text-caption text-mid-grey"
              style={{ fontFamily: FONT.regular, fontVariant: ["tabular-nums"], flexShrink: 0 }}
            >
              {tp("layerCard.items", items)}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            className="mt-0.5 text-caption text-mid-grey"
            style={{ fontFamily: FONT.regular }}
          >
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.placeholder} strokeWidth={1.9} />
      </View>
    </Tappable>
  );
}
