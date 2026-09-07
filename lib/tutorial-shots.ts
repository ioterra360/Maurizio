import type { Locale } from "./i18n";
import type { ThemeScheme } from "@/theme/palettes";

/**
 * Gli screenshot VERI dell'app che il tutorial mostra (Angelo, 7/9/2026:
 * "deve spiegarlo con le immagini reali dell'applicazione"). Catturati
 * dall'app in demo su Expo web per ogni lingua e per ogni tema
 * (scripts/tutorial-shots/capture.cjs), ridotti a 720 px e salvati in WebP
 * (convert.py) in assets/tutorial/<schermata>-<lingua>-<tema>.webp.
 *
 * Modulo PURO: i nomi dei file, non le immagini. Le `require` statiche
 * (Metro le vuole letterali) stanno in lib/tutorial-shot-sources.ts; il
 * test controlla che per ogni combinazione il file esista sul disco.
 */

export const TUTORIAL_SHOTS = [
  "today",
  "knowledge",
  "add",
  "focus",
  "health",
  "notifications",
] as const;
export type TutorialShot = (typeof TUTORIAL_SHOTS)[number];

/** Larghezza/altezza della cattura (412x915 CSS px): la cornice la rispetta. */
export const SHOT_ASPECT = 412 / 915;

export function shotAssetName(shot: TutorialShot, locale: Locale, scheme: ThemeScheme): string {
  return `${shot}-${locale}-${scheme}.webp`;
}
