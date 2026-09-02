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
import { FONT, useColors } from "@/theme/tokens";

type Props = { label?: string; size?: number };

/**
 * Loader brandizzato: la mascotte oscilla dolcemente al posto degli
 * ActivityIndicator (spec core-loop §10 — caricamenti con la mascotte).
 * Centrato dal contenitore che lo ospita.
 */
// 96 instead of 84: the idea artwork is wider than tall, so at the same box
// the brain reads ~13% smaller than the old square default did.
export function MascotLoader({ label, size = 96 }: Props) {
  const colors = useColors();
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
        {/* "idea" (brain at the laptop, 544 px source) instead of the 130 px
            default, which upscaled to a blur at 84 dp on 3x screens. */}
        <Mascot variant="idea" size={size} withShadow={false} />
      </Animated.View>
      {label ? (
        <Text style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
