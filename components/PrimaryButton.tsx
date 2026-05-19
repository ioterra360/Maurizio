import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** "fill" (default) = navy bg; "tonal" = light navy bg, navy text. */
  variant?: "fill" | "tonal";
  style?: StyleProp<ViewStyle>;
};

/**
 * The primary call-to-action used across the app — Start Today's Review,
 * Save, Get started, Continue. Matches the mockup's 54px navy pill
 * with a soft drop shadow.
 */
export function PrimaryButton({ label, onPress, loading, disabled, variant = "fill", style }: Props) {
  const isDisabled = disabled || loading;
  const fill = variant === "fill";
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className="w-full items-center justify-center rounded-cta"
      style={({ pressed }) => [
        {
          height: 54,
          backgroundColor: fill ? colors.navy : colors.tagUserBg,
          opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1,
          shadowColor: colors.navy,
          shadowOpacity: fill ? 0.32 : 0,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 18,
          elevation: fill ? 4 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fill ? "#fff" : colors.navy} />
      ) : (
        <Text
          className="text-cta"
          style={{ fontFamily: FONT.semibold, color: fill ? "#fff" : colors.navy }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
