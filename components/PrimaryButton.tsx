import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, colors, radii } from "@/theme/tokens";
import { tap as tapFeedback } from "@/lib/feedback";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /**
   * "fill" (default) = filled navy + white text + drop shadow. The confident,
   *   dominant primary action.
   * "outline" = white surface + navy text + navy 1.5-px border (cancel-style).
   * "tonal" = soft tag-blue fill, navy text (low-emphasis secondary).
   * "danger" = filled red + white text + red glow (destructive ops).
   */
  variant?: "fill" | "outline" | "tonal" | "danger";
  /** Optional fill-color override (e.g. a layer color on the review handoff). */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The primary call-to-action across the app — Accedi, Crea account, Salva,
 * Continua. The visual box is a plain <View> with a STATIC style so the
 * background always renders; the Pressable only owns the touch + press state.
 * (NativeWind v4 drops the `style={({pressed}) => …}` render-prop form on
 * pressable components, which previously made the navy fill disappear.)
 */
export function PrimaryButton({ label, onPress, loading, disabled, variant = "fill", color, style }: Props) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);

  const fillColor = variant === "fill" && color ? color : colors.navy;
  const bg =
    variant === "fill"
      ? fillColor
      : variant === "danger"
        ? colors.danger
        : variant === "tonal"
          ? colors.tagUserBg
          : colors.surface;

  const textColor =
    variant === "fill" || variant === "danger" ? colors.warmWhite : colors.navy;

  const borderColor = variant === "outline" ? colors.navy : "transparent";
  const borderWidth = variant === "outline" ? 1.5 : 0;

  const shadowTint =
    variant === "danger" ? colors.danger : variant === "fill" ? fillColor : colors.navy;
  const shadowOpacity =
    variant === "fill" || variant === "danger" ? 0.3 : variant === "tonal" ? 0.1 : 0.08;
  const elevation = variant === "fill" || variant === "danger" ? 4 : variant === "tonal" ? 2 : 1;

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return;
        tapFeedback();
        onPress?.();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[{ width: "100%" }, style]}
    >
      <View
        style={{
          width: "100%",
          height: 54,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radii.cta,
          backgroundColor: bg,
          borderColor,
          borderWidth,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
          shadowColor: shadowTint,
          shadowOpacity,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 16,
          elevation,
        }}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text style={{ fontFamily: FONT.semibold, fontSize: 17, color: textColor, letterSpacing: -0.16 }}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
