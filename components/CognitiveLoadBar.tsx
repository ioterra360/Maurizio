import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";

type Props = {
  /** 0–100. */
  pct: number;
};

/**
 * 3-zone segmented bar with a marker pip at the current load percentage.
 * Green (0-60 sustainable) → peach (60-85 heavy) → navy (85-100 overload).
 */
export function CognitiveLoadBar({ pct }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const zone =
    clamped < 60 ? { color: colors.active, label: "SUSTAINABLE" }
    : clamped < 85 ? { color: colors.fading, label: "HEAVY" }
    : { color: colors.navy, label: "OVERLOADED" };

  return (
    <View>
      <View style={{ position: "relative", marginTop: 10 }}>
        <View
          className="flex-row overflow-hidden"
          style={{ height: 10, borderRadius: 5, backgroundColor: colors.divider }}
        >
          <View style={{ flex: 60, backgroundColor: colors.active }} />
          <View style={{ flex: 25, backgroundColor: colors.fading }} />
          <View style={{ flex: 15, backgroundColor: colors.navy }} />
        </View>
        {/* Marker */}
        <View
          style={{
            position: "absolute",
            top: -4,
            left: `${clamped}%`,
            transform: [{ translateX: -9 }],
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: "#fff",
            borderWidth: 2,
            borderColor: colors.navy,
            shadowColor: colors.navy,
            shadowOpacity: 0.18,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 6,
            elevation: 2,
          }}
        />
      </View>

      <View
        className="mt-2 flex-row justify-between"
        style={{ marginTop: 12 }}
      >
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 10.5,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          Sustainable
        </Text>
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 10.5,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          Heavy
        </Text>
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 10.5,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          Overloaded
        </Text>
      </View>

      <Text
        className="mt-3"
        style={{
          fontFamily: FONT.bold,
          fontSize: 13,
          color: zone.color,
          letterSpacing: 1.4,
        }}
      >
        {zone.label}
      </Text>
    </View>
  );
}
