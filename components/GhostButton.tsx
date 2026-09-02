import { useState } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, radii, useColors } from "@/theme/tokens";

type Props = {
  label: string;
  onPress?: () => void;
  /** "link" = mid-grey text button; "outline" = bordered button on white. */
  variant?: "link" | "outline";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Secondary CTAs — "Forse più tardi", "Adjust today's flow", etc. Like
 * PrimaryButton, the visual box is a static-styled <View> so it always
 * renders (NativeWind v4 drops the render-prop `style` function on Pressable).
 */
export function GhostButton({ label, onPress, variant = "link", disabled, style }: Props) {
  const [pressed, setPressed] = useState(false);
  const colors = useColors();

  if (variant === "outline") {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        style={[{ width: "100%" }, style]}
      >
        <View
          style={{
            width: "100%",
            height: 52,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radii.cta,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.navy,
            opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          }}
        >
          <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: colors.navy, letterSpacing: -0.16 }}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={style}
    >
      <View
        style={{
          alignSelf: "center",
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: 16,
          opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
        }}
      >
        <Text style={{ fontFamily: FONT.medium, fontSize: 15, color: colors.midGrey }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
