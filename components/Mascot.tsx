import { Image, View, type ImageStyle, type StyleProp } from "react-native";

type MascotProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * The Memora brand mascot. Same character used everywhere — in the onboarding
 * hero (~170px), in coach bubbles (~44px), and as login art.
 */
export function Mascot({ size = 44, style }: MascotProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={require("../assets/brand/mascot.png")}
        resizeMode="contain"
        style={[{ width: "100%", height: "100%" }, style]}
      />
    </View>
  );
}
