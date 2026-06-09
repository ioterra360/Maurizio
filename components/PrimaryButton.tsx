import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import { tap as tapFeedback } from "@/lib/feedback";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * "fill" (default) = filled navy + white text + drop shadow. The visual
   * contract from Claude Design — confident, dominant primary action.
   * "outline" = warm-white surface + navy text + navy 1.5-px border. Used
   *   when an outlined-only treatment is intentional (cancel-style).
   * "tonal" = soft tag-blue background, navy text (low emphasis).
   * "danger" = filled red with white text + red glow (destructive ops).
   */
  variant?: "fill" | "outline" | "tonal" | "danger";
  /**
   * Optional fill-color override (e.g. a layer color on the review handoff).
   * Applies to the "fill" variant only: replaces the navy background and the
   * shadow tint with this color, keeping white text. Mirrors the design's
   * `background: toData.color` handoff button in reviews.jsx.
   */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The primary call-to-action used across the app — Accedi, Crea account,
 * Save, Continua. Default is filled-navy per the design contract.
 */
export function PrimaryButton({ label, onPress, loading, disabled, variant = "fill", color, style }: Props) {
  const isDisabled = disabled || loading;

  // A color override only makes sense on the filled treatment.
  const fillColor = variant === "fill" && color ? color : colors.navy;

  const bg =
    variant === "fill"
      ? fillColor
      : variant === "danger"
        ? colors.danger
        : variant === "tonal"
          ? colors.tagUserBg
          : colors.warmWhite;

  const textColor =
    variant === "fill" || variant === "danger" ? colors.warmWhite : colors.navy;

  const borderColor = variant === "outline" ? colors.navy : "transparent";
  const borderWidth = variant === "outline" ? 1.5 : 0;

  const shadowTint =
    variant === "danger" ? colors.danger : variant === "fill" ? fillColor : colors.navy;
  const shadowOpacity =
    variant === "fill" || variant === "danger" ? 0.32 : variant === "outline" ? 0.12 : 0.08;
  const elevation = variant === "fill" || variant === "danger" ? 4 : variant === "outline" ? 2 : 1;

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
          shadowColor: shadowTint,
          shadowOpacity,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 18,
          elevation,
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
