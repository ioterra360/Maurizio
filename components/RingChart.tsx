import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { FONT, colors } from "@/theme/tokens";

type Segment = { color: string; pct: number };

type Props = {
  size?: number;
  strokeWidth?: number;
  segments: Segment[];
  /** The large number in the middle (e.g. 62). */
  centerValue: string;
  /** The small label below the number (e.g. "Stable" or "%"). */
  centerLabel?: string;
  /** Inner text color — defaults to white (used on the navy panel). */
  textColor?: string;
};

/**
 * Donut-style chart for Memory Health. Segments are drawn in order with
 * accumulating offsets; total can be less than 100 (remainder shows the
 * track color through).
 */
export function RingChart({
  size = 160,
  strokeWidth = 14,
  segments,
  centerValue,
  centerLabel,
  textColor = colors.warmWhite,
}: Props) {
  const r = size / 2 - strokeWidth;
  const C = 2 * Math.PI * r;
  let cumulativeOffset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(250,248,244,0.14)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((s, i) => {
          const dash = (s.pct / 100) * C;
          const seg = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-cumulativeOffset}
              strokeLinecap="butt"
            />
          );
          cumulativeOffset += dash;
          return seg;
        })}
      </Svg>
      <View
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View className="flex-row items-baseline">
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 34,
              color: textColor,
              letterSpacing: -1,
              fontVariant: ["tabular-nums"],
              lineHeight: 36,
            }}
          >
            {centerValue}
          </Text>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 18,
              color: textColor,
              opacity: 0.7,
            }}
          >
            %
          </Text>
        </View>
        {centerLabel ? (
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 11,
              color: textColor,
              opacity: 0.65,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type LegendDotProps = { color: string; label: string; pct: string; onDark?: boolean };

export function LegendDot({ color, label, pct, onDark = true }: LegendDotProps) {
  const textColor = onDark ? "rgba(250,248,244,0.82)" : colors.midGrey;
  const pctColor = onDark ? colors.warmWhite : colors.navy;
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: FONT.medium, fontSize: 11.5, color: textColor }}>{label}</Text>
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: 11.5,
          color: pctColor,
          fontVariant: ["tabular-nums"],
        }}
      >
        {pct}
      </Text>
    </View>
  );
}
