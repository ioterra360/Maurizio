import { Image, View, type ImageStyle, type StyleProp } from "react-native";

export type MascotVariant =
  | "default" // classic winking brain mascot
  | "idea" // brain + open book + lightbulb (Eureka)
  | "checklist" // brain + speech bubble with checks
  | "investigate" // brain + magnifying glass
  | "announce"; // brain + megaphone + lightbulb

const SOURCES = {
  default: require("../assets/brand/mascot.png"),
  idea: require("../assets/brand/mascot-idea.png"),
  checklist: require("../assets/brand/mascot-checklist.png"),
  investigate: require("../assets/brand/mascot-investigate.png"),
  announce: require("../assets/brand/mascot-announce.png"),
} as const;

type MascotProps = {
  size?: number;
  variant?: MascotVariant;
  /** Adds a soft floating drop-shadow. Default true for hero usages. */
  withShadow?: boolean;
  style?: StyleProp<ImageStyle>;
};

/**
 * The Memika brand mascot. Five expressive variants live in
 * assets/brand/ — see MascotVariant for the catalog. Used in the login
 * hero, onboarding, and coach-tip speech bubbles.
 *
 * Decorative by default — screen readers should skip it. Pass a label via
 * accessibility props on the parent if context requires it.
 */
export function Mascot({
  size = 44,
  variant = "default",
  withShadow = true,
  style,
}: MascotProps) {
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
        source={SOURCES[variant]}
        resizeMode="contain"
        style={[{ width: size, height: size }, style]}
      />
    </View>
  );
}
