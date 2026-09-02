/**
 * Memika design tokens
 *
 * Dal 2026-09-02 i valori vivono in theme/palettes.ts (chiaro + scuro) e i
 * componenti li leggono con useColors() / useThemeTokens()
 * (theme/theme-store.ts) così seguono il cambio tema al volo.
 *
 * Gli export statici qui sotto sono la TAVOLOZZA CHIARA e restano per:
 *   1. il codice non ancora convertito all'hook (rende sempre in chiaro);
 *   2. i default a livello di modulo dove un hook non può girare.
 * NON aggiungere nuovi consumi statici: usa gli hook.
 *
 * FONT e radii non dipendono dal tema e restano qui.
 */

import { light } from "./palettes";

export { useColors, useThemeStore, useThemeTokens, currentTokens } from "./theme-store";
export type { ThemeColors, ThemeScheme, ThemeTokens } from "./palettes";

export const colors = light.colors;

/**
 * Cross-domain aliases. The mockup reuses semantic colors as plain accents
 * (e.g. the green-checkmark on Complete uses the "active" hex). Use these
 * names when the meaning isn't the semantic role.
 */
export const palette = light.palette;

export const radii = {
  tag: 6,
  input: 12,
  /**
   * CTA radius matches `card` (14) per mockup. Previously 13 — drift
   * from the design. Don't reintroduce the asymmetry.
   */
  cta: 14,
  card: 14,
  chip: 10,
  filter: 8,
  pill: 999,
} as const;

/**
 * Soft layer-tint backgrounds — used on tinted "Folder" pills above the
 * term in review screens, layer pip backgrounds in onboarding, and
 * handoff next-layer hero. Kept centralized so the three tints can't drift.
 */
export const layerTint = light.layerTint;

/**
 * Per-folder identity tints — legacy (le cartelle nuove portano l'emoji e
 * usano la tinta neutra `custom`). Also used by the admin recall chart.
 */
export const folderTint = light.folderTint;

/**
 * Memory lifecycle status tints — used by ItemRow, HealthRow and any
 * pill/chip that visualises an active/fading/archived state.
 */
export const statusTint = light.statusTint;

/** Admin moderation severity tints. */
export const severityTint = light.severityTint;

export const layer = light.layer;

export type LayerKey = keyof typeof light.layer;

/** Inter font family literals — wrap to avoid string typos at call sites. */
export const FONT = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;
