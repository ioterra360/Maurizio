import { Text, View } from "react-native";
import { FONT, useColors } from "@/theme/tokens";
import { useT } from "@/lib/i18n";

type Props = {
  /** 0–100. */
  pct: number;
};

/**
 * 3-zone segmented bar with a marker pip at the current load percentage.
 * Green (0-60 sustainable) → peach (60-85 heavy) → navy (85-100 overload).
 */
export function CognitiveLoadBar({ pct }: Props) {
  const { t } = useT();
  const colors = useColors();
  const clamped = Math.max(0, Math.min(100, pct));
  const zone =
    clamped < 60 ? { color: colors.active, label: t("cognitiveLoadBar.sustainable") }
    : clamped < 85 ? { color: colors.fading, label: t("cognitiveLoadBar.demanding") }
    : { color: colors.navy, label: t("cognitiveLoadBar.overloaded") };

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
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.navy,
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
            fontSize: 12,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          {t("cognitiveLoadBar.sustainable")}
        </Text>
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 12,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          {t("cognitiveLoadBar.demanding")}
        </Text>
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 12,
            color: colors.midGrey,
            letterSpacing: 0.6,
          }}
        >
          {t("cognitiveLoadBar.overloaded")}
        </Text>
      </View>

      <Text
        className="mt-3"
        style={{
          fontFamily: FONT.bold,
          fontSize: 14,
          color: zone.color,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {zone.label}
      </Text>
    </View>
  );
}
