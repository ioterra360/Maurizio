import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Mascot } from "@/components/Mascot";
import { FONT, colors } from "@/theme/tokens";

type Props = { label?: string; size?: number };

/**
 * Loader brandizzato: la mascotte oscilla dolcemente al posto degli
 * ActivityIndicator (spec core-loop §10 — caricamenti con la mascotte).
 * Centrato dal contenitore che lo ospita.
 */
export function MascotLoader({ label, size = 84 }: Props) {
  const sway = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(
      withSequence(withTiming(1, { duration: 520 }), withTiming(-1, { duration: 520 })),
      -1,
      true,
    );
  }, [sway]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${sway.value * 8}deg` },
      { translateY: Math.abs(sway.value) * -4 },
    ],
  }));
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Animated.View style={style}>
        <Mascot variant="default" size={size} withShadow={false} />
      </Animated.View>
      {label ? (
        <Text style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
