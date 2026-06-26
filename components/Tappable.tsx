import { useState } from "react";
import {
  Pressable,
  View,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  /**
   * Visual box style — background, border, padding, radius, flex-direction,
   * gap, shadow, etc. Lives on the INNER <View>, which always renders (this is
   * the whole point: it sidesteps the NativeWind v4 bug where a render-prop
   * `style={({ pressed }) => …}` on a pressable is silently dropped).
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Outer-Pressable layout — flex / width / alignSelf / margins — so the
   * button participates correctly in its parent's flex layout.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /** Opacity while pressed (default 0.85). */
  pressedOpacity?: number;
  disabled?: boolean;
  hitSlop?: number;
  delayLongPress?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean; busy?: boolean };
};

/**
 * Touchable whose visual box is a static-styled <View>. Use this anywhere a
 * tappable needs a background / border / padding that must actually render.
 * Pass visual styles via `style`; pass flex/width/margins via `containerStyle`.
 */
export function Tappable({
  children,
  onPress,
  onLongPress,
  style,
  containerStyle,
  pressedOpacity = 0.85,
  disabled,
  hitSlop,
  delayLongPress,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={containerStyle}
    >
      <View style={[style, { opacity: disabled ? 0.5 : pressed ? pressedOpacity : 1 }]}>
        {children}
      </View>
    </Pressable>
  );
}
