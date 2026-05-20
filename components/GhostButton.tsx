import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  label: string;
  onPress?: () => void;
  /** "link" = mid-grey small text; "outline" = bordered button. */
  variant?: "link" | "outline";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Secondary CTAs — "Adjust today's flow", "Save & add another", etc.
 */
export function GhostButton({ label, onPress, variant = "link", disabled, style }: Props) {
  if (variant === "outline") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        className="w-full items-center justify-center rounded-cta"
        style={({ pressed }) => [
          {
            height: 44,
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.hairlineStrong,
            opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          },
          style,
        ]}
      >
        <Text className="text-body" style={{ fontFamily: FONT.medium, color: colors.navy }}>
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.6 : 1 }, style]}
    >
      <Text
        className="text-body text-mid-grey"
        style={{ fontFamily: FONT.medium }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
