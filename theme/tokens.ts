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
  warmWhite: "#FAF8F4",
  surface: "#FFFFFF",
  midGrey: "#8A8A88",
  placeholder: "#B5B3AE",
  hairline: "rgba(26,44,79,0.08)",
  hairlineStrong: "rgba(26,44,79,0.14)",
  divider: "#EFEDE7",
  // Layer colors (Scan → Reinforcement → Focus, locked order).
  scan: "#6DA8E5",
  reinforcement: "#9B8CE8",
  focus: "#1A2C4F",
  // Memory states.
  active: "#3EC07B",
  fading: "#F5A89C",
  archived: "#C5C3BE",
  // Semantic.
  danger: "#B04A38",
  dangerSoft: "#FDEEEA",
  // Cards: USER tag background + ADMIN tag background.
  tagUserBg: "#EDF0F6",
} as const;

/**
 * Cross-domain aliases. The mockup reuses semantic colors as plain accents
 * (e.g. the green-checkmark on Complete uses the "active" hex). Use these
 * names when the meaning isn't the semantic role.
 */
export const palette = {
  green: colors.active,
  peach: colors.fading,
  violet: colors.reinforcement,
  blue: colors.scan,
} as const;

export const radii = {
  tag: 6,
  input: 12,
  cta: 13,
  card: 14,
  chip: 10,
  pill: 999,
} as const;

export const layer = {
  scan: { color: colors.scan, label: "Scan", icon: "Radar" },
  reinforcement: { color: colors.reinforcement, label: "Reinforcement", icon: "Repeat" },
  focus: { color: colors.focus, label: "Focus", icon: "Target" },
} as const;

export type LayerKey = keyof typeof layer;

/** Inter font family literals — wrap to avoid string typos at call sites. */
export const FONT = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;
