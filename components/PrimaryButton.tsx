import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import { tap as tapFeedback } from "@/lib/feedback";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * "fill" (default) = light surface CTA with navy text + navy border. The
   * previous filled-navy variant was reverted on 2026-05-22 because the
   * white text on navy was illegible on Angelo's device.
   * "tonal" = soft tag-blue background, navy text (low emphasis).
   * "solidNavy" = the classic filled-navy CTA, kept for places where a
   *   dark surface is design-intentional (e.g. inside the subscribe hero).
   */
  variant?: "fill" | "tonal" | "solidNavy";
  style?: StyleProp<ViewStyle>;
};

/**
 * The primary call-to-action used across the app — Accedi, Crea account,
 * Save, Continua. Cream surface with strong navy text + border so the
 * label is unambiguously legible on any device.
 */
export function PrimaryButton({ label, onPress, loading, disabled, variant = "fill", style }: Props) {
  const isDisabled = disabled || loading;
  const solid = variant === "solidNavy";
  const tonal = variant === "tonal";

  const bg = solid ? colors.navy : tonal ? colors.tagUserBg : colors.warmWhite;
  const textColor = solid ? colors.warmWhite : colors.navy;
  const borderColor = solid ? "transparent" : colors.navy;
  const borderWidth = solid ? 0 : 1.5;

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return;
        tapFeedback();
        onPress?.();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className="w-full items-center justify-center rounded-cta"
      style={({ pressed }) => [
        {
          height: 54,
          backgroundColor: bg,
          borderColor,
          borderWidth,
          opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1,
          shadowColor: colors.navy,
          shadowOpacity: solid ? 0.32 : 0.16,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 18,
          elevation: solid ? 4 : 2,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          className="text-cta"
          style={{ fontFamily: FONT.semibold, color: textColor, letterSpacing: -0.16 }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
