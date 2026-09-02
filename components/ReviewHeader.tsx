import { Text, View } from "react-native";
import { ChevronLeft, Radar, Repeat, Target, type LucideIcon } from "lucide-react-native";
import { FONT, useThemeTokens, type LayerKey } from "@/theme/tokens";
import { Tappable } from "@/components/Tappable";
import { safeBack } from "@/lib/safe-back";
import { useT } from "@/lib/i18n";

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
  const { t } = useT();
  const { colors, layer } = useThemeTokens();
  const { color, label } = layer[layerKey];
  const Icon = ICONS[layerKey];

  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 }}
    >
      <Tappable
        onPress={() => safeBack("/(app)/today")}
        accessibilityRole="button"
        accessibilityLabel={t("reviewHeader.exitA11y")}
        hitSlop={10}
        pressedOpacity={0.5}
        style={{
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
      </Tappable>

      <View className="flex-row" style={{ gap: 6, flex: 1, justifyContent: "center" }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i <= index ? color : colors.dotIdle,
            }}
          />
        ))}
      </View>

      <View className="flex-row items-center" style={{ gap: 6, flexShrink: 0 }}>
        <Icon size={14} color={color} strokeWidth={2.1} />
        <Text
          numberOfLines={1}
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
