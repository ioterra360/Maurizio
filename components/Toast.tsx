import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FONT } from "@/theme/tokens";

type Props = {
  message: string | null;
  onDismiss?: () => void;
  /** Auto-dismiss timeout in ms. 0 disables. Default 1800. */
  durationMs?: number;
};

/**
 * Compact toast notification that slides up from the bottom. Sits above
 * the tab bar (~80px from the bottom). Calls onDismiss after duration.
 */
export function Toast({ message, onDismiss, durationMs = 1800 }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (message) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 220 });
      if (durationMs > 0) {
        const t = setTimeout(() => {
          opacity.value = withTiming(0, { duration: 220 });
          translateY.value = withTiming(10, { duration: 220 });
          setTimeout(() => onDismiss?.(), 240);
        }, durationMs);
        return () => clearTimeout(t);
      }
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(10, { duration: 200 });
    }
  }, [message, durationMs, opacity, translateY, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: "50%",
          marginLeft: -120, // half of the 240 width — centers the pill
          bottom: 110,
          width: 240,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 12,
          backgroundColor: "#1A2C4F",
          shadowColor: "#1A2C4F",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 16 },
          shadowRadius: 28,
          elevation: 8,
          zIndex: 100,
          alignItems: "center",
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          color: "#fff",
          fontFamily: FONT.medium,
          fontSize: 13,
          letterSpacing: -0.07,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
