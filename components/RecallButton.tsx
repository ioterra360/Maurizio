import { Pressable, Text, View } from "react-native";
import { Check, TriangleAlert, X, type LucideIcon } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";

export type Recall = "remembered" | "struggled" | "forgot";

type Props = {
  variant: Recall;
  onPress?: () => void;
};

const META: Record<
  Recall,
  { label: string; icon: LucideIcon; bg: string; border: string; text: string; iconColor: string; shadow?: boolean }
> = {
  // Filled primary uses navy (matches "Start Today's Review" and the other
  // review CTAs) instead of the layer-local accent — Angelo's call: a
  // consistent dark-blue family across all confirm actions.
  remembered: { label: "Ricordato",  icon: Check,         bg: colors.warmWhite, border: colors.navy,           text: colors.navy,   iconColor: colors.navy,   shadow: true },
  struggled:  { label: "Faticoso",   icon: TriangleAlert, bg: "transparent",     border: colors.hairlineStrong, text: colors.navy,   iconColor: colors.navy },
  forgot:     { label: "Dimenticato",icon: X,             bg: "transparent",     border: colors.fading,         text: colors.fading, iconColor: colors.fading },
};

/**
 * The three recall buttons on the Focus review layer. Pressable variants —
 * the green "Remembered" gets a glow, the others are outlined.
 */
export function RecallButton({ variant, onPress }: Props) {
  const m = META[variant];
  const Icon = m.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.label}
      className="w-full flex-row items-center justify-center rounded-card"
      style={({ pressed }) => ({
        height: 60,
        backgroundColor: m.bg,
        borderWidth: 1.5,
        borderColor: m.border,
        opacity: pressed ? 0.85 : 1,
        gap: 10,
        shadowColor: m.shadow ? colors.navy : "transparent",
        shadowOpacity: m.shadow ? 0.22 : 0,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 18,
        elevation: m.shadow ? 3 : 0,
      })}
    >
      <Icon size={20} color={m.iconColor} strokeWidth={2.1} />
      <Text
        style={{
          fontFamily: FONT.bold,
          fontSize: 18,
          color: m.text,
          letterSpacing: -0.1,
        }}
      >
        {m.label}
      </Text>
    </Pressable>
  );
}

/**
 * Reusable progress-dots row for review screens.
 */
export function ProgressDots({
  total,
  active,
  color = colors.navy,
}: {
  total: number;
  active: number;
  color?: string;
}) {
  return (
    <View className="flex-row" style={{ gap: 7 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i <= active ? color : "#DCDAD3",
          }}
        />
      ))}
    </View>
  );
}
