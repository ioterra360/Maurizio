import { View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { colors } from "@/theme/tokens";

type Props = {
  /** Width is provided by the parent; height defaults to mockup spec. */
  width?: number;
  height?: number;
};

const DAYS = 30;

/**
 * Three smooth survival curves over a 30-day window — Focus / Reinforcement /
 * Scan. Replaces the earlier flex+margin hack with a real SVG. Polylines
 * are sampled from an ease-out interpolation from 100% down to each layer's
 * terminal retention.
 */
export function RetentionCurves({ width = 320, height = 90 }: Props) {
  const focusEnd = 91;
  const reinfEnd = 74;
  const scanEnd = 62;

  const focus = curve(focusEnd, width, height);
  const reinf = curve(reinfEnd, width, height);
  const scan = curve(scanEnd, width, height);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Dashed reference lines at 25 / 50 / 75 */}
        {[25, 50, 75].map((pct) => {
          const y = height - (pct / 100) * height;
          return (
            <Line
              key={pct}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke={colors.hairline}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          );
        })}
        <Polyline points={scan} stroke={colors.scan} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Polyline points={reinf} stroke={colors.reinforcement} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Polyline points={focus} stroke={colors.focus} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/**
 * Returns a sampled SVG polyline points string mapping day → y coordinate.
 * Curve starts at 100% (top), eases out to `endPct` (bottom).
 */
function curve(endPct: number, w: number, h: number): string {
  const steps = DAYS;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pct = 100 - (100 - endPct) * (t * t); // ease-out
    const x = (i / steps) * w;
    const y = h - (pct / 100) * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
