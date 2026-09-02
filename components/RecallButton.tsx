import { Text, View } from "react-native";
import { Check, TriangleAlert, X, type LucideIcon } from "lucide-react-native";
import { Tappable } from "@/components/Tappable";
import { useT, type TKey } from "@/lib/i18n";
import { FONT, radii, useColors, useThemeTokens } from "@/theme/tokens";

export type Recall = "remembered" | "struggled" | "forgot";

type Props = {
  variant: Recall;
  onPress?: () => void;
};

type RecallMeta = {
  labelKey: TKey;
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  shadowColor?: string;
};

/**
 * Recall buttons of the Focus review layer. Focus renders "forgot" and
 * "remembered" (binary answers since 2026-08-29); the "struggled" variant is
 * kept for when the intermediate answer returns with its own timing. The
 * green "Remembered" gets a glow, the others are outlined.
 */
export function RecallButton({ variant, onPress }: Props) {
  const { t } = useT();
  const { colors, statusTint } = useThemeTokens();

  // Per the Claude Design contract (reviews.jsx:410): the primary confirm
  // is filled GREEN with a green glow shadow. Layer-local color, not navy.
  // Deliberate a11y deviation from the mockup (screens.jsx:731): "forgot"
  // keeps the peach border but uses statusTint.fading.text as ink — peach
  // text on warm-white is ~1.8:1, far below the WCAG 3:1 large-text bar.
  // Labels are catalog keys, resolved at render via useT() so the Settings
  // language switch applies at once.
  const META: Record<Recall, RecallMeta> = {
    remembered: { labelKey: "recallButton.remembered", icon: Check,         bg: colors.active,    border: colors.active,         text: colors.warmWhite, iconColor: colors.warmWhite, shadowColor: colors.active },
    struggled:  { labelKey: "recallButton.struggled",  icon: TriangleAlert, bg: "transparent",    border: colors.hairlineStrong, text: colors.navy,      iconColor: colors.navy },
    forgot:     { labelKey: "recallButton.forgot",     icon: X,             bg: "transparent",    border: colors.fading,         text: statusTint.fading.text, iconColor: statusTint.fading.text },
  };

  const m = META[variant];
  const Icon = m.icon;
  const label = t(m.labelKey);
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      containerStyle={{ width: "100%" }}
      style={{
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.card,
        height: 60,
        backgroundColor: m.bg,
        borderWidth: 1.5,
        borderColor: m.border,
        gap: 10,
        shadowColor: m.shadowColor ?? "transparent",
        shadowOpacity: m.shadowColor ? 0.45 : 0,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        elevation: m.shadowColor ? 4 : 0,
      }}
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
        {label}
      </Text>
    </Tappable>
  );
}

/**
 * Reusable progress-dots row for review screens.
 */
export function ProgressDots({
  total,
  active,
  color,
}: {
  total: number;
  active: number;
  color?: string;
}) {
  const colors = useColors();
  const fillColor = color ?? colors.navy;
  return (
    <View className="flex-row" style={{ gap: 7 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i <= active ? fillColor : colors.dotIdle,
          }}
        />
      ))}
    </View>
  );
}
