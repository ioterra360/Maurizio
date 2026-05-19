import { Image, View, type ImageStyle, type StyleProp } from "react-native";

type MascotProps = {
  size?: number;
  /** Adds a soft floating drop-shadow. Default true for hero usages. */
  withShadow?: boolean;
  style?: StyleProp<ImageStyle>;
};

/**
 * The Memora brand mascot. Same character used everywhere — in the onboarding
 * hero (~170px, animated in Phase 2), in coach bubbles (~44px), and as login art.
 *
 * Decorative by default — screen readers should skip it. Pass a label via
 * accessibility props on the parent if context requires it.
 */
export function Mascot({ size = 44, withShadow = true, style }: MascotProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={
        withShadow
          ? {
              shadowColor: "#1A2C4F",
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 14,
              elevation: 3,
            }
          : undefined
      }
    >
      <Image
        accessibilityIgnoresInvertColors
        source={require("../assets/brand/mascot.png")}
        resizeMode="contain"
        style={[{ width: size, height: size }, style]}
      />
    </View>
  );
}
