/**
 * Memora design tokens
 *
 * Source of truth: _design_drop/memora/project/Memora App.html (editorial direction).
 * Mirrors tailwind.config.js so non-NativeWind consumers (e.g. SVG, Reanimated)
 * can reference identical values.
 */

export const colors = {
  navy: "#1A2C4F",
  canvas: "#F5F3EF",
  warmWhite: "#FBF9F4",
  surface: "#FFFFFF",
  midGrey: "#8A8A88",
  hairline: "rgba(26,44,79,0.08)",
  hairlineStrong: "rgba(26,44,79,0.16)",
  scan: "#6DA8E5",
  reinforcement: "#9B8CE8",
  focus: "#1A2C4F",
  active: "#3EC07B",
  fading: "#F5A89C",
  archived: "#C5C3BE",
  danger: "#B04A38",
} as const;

export const radii = {
  card: 14,
  pill: 999,
  chip: 10,
} as const;

export const layer = {
  scan: { color: colors.scan, label: "Scan", icon: "Radar" },
  reinforcement: { color: colors.reinforcement, label: "Reinforcement", icon: "Repeat" },
  focus: { color: colors.focus, label: "Focus", icon: "Target" },
} as const;

export type LayerKey = keyof typeof layer;
