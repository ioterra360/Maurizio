import type { ImageSourcePropType } from "react-native";

import type { Locale } from "./i18n";
import type { ThemeScheme } from "@/theme/palettes";
import { type TutorialShot, shotAssetName } from "./tutorial-shots";

/**
 * Le require STATICHE degli screenshot del tutorial (Metro le vuole
 * letterali: niente template string dentro require). Generato da
 * scripts/tutorial-shots: se aggiungi una schermata o una lingua, rigenera
 * la lista; lib/tutorial-shots.test.ts controlla che sia completa.
 */
const SOURCES: Record<string, ImageSourcePropType> = {
  "today-it-light.webp": require("../assets/tutorial/today-it-light.webp"),
  "today-it-dark.webp": require("../assets/tutorial/today-it-dark.webp"),
  "today-en-light.webp": require("../assets/tutorial/today-en-light.webp"),
  "today-en-dark.webp": require("../assets/tutorial/today-en-dark.webp"),
  "today-fr-light.webp": require("../assets/tutorial/today-fr-light.webp"),
  "today-fr-dark.webp": require("../assets/tutorial/today-fr-dark.webp"),
  "today-es-light.webp": require("../assets/tutorial/today-es-light.webp"),
  "today-es-dark.webp": require("../assets/tutorial/today-es-dark.webp"),
  "knowledge-it-light.webp": require("../assets/tutorial/knowledge-it-light.webp"),
  "knowledge-it-dark.webp": require("../assets/tutorial/knowledge-it-dark.webp"),
  "knowledge-en-light.webp": require("../assets/tutorial/knowledge-en-light.webp"),
  "knowledge-en-dark.webp": require("../assets/tutorial/knowledge-en-dark.webp"),
  "knowledge-fr-light.webp": require("../assets/tutorial/knowledge-fr-light.webp"),
  "knowledge-fr-dark.webp": require("../assets/tutorial/knowledge-fr-dark.webp"),
  "knowledge-es-light.webp": require("../assets/tutorial/knowledge-es-light.webp"),
  "knowledge-es-dark.webp": require("../assets/tutorial/knowledge-es-dark.webp"),
  "add-it-light.webp": require("../assets/tutorial/add-it-light.webp"),
  "add-it-dark.webp": require("../assets/tutorial/add-it-dark.webp"),
  "add-en-light.webp": require("../assets/tutorial/add-en-light.webp"),
  "add-en-dark.webp": require("../assets/tutorial/add-en-dark.webp"),
  "add-fr-light.webp": require("../assets/tutorial/add-fr-light.webp"),
  "add-fr-dark.webp": require("../assets/tutorial/add-fr-dark.webp"),
  "add-es-light.webp": require("../assets/tutorial/add-es-light.webp"),
  "add-es-dark.webp": require("../assets/tutorial/add-es-dark.webp"),
  "focus-it-light.webp": require("../assets/tutorial/focus-it-light.webp"),
  "focus-it-dark.webp": require("../assets/tutorial/focus-it-dark.webp"),
  "focus-en-light.webp": require("../assets/tutorial/focus-en-light.webp"),
  "focus-en-dark.webp": require("../assets/tutorial/focus-en-dark.webp"),
  "focus-fr-light.webp": require("../assets/tutorial/focus-fr-light.webp"),
  "focus-fr-dark.webp": require("../assets/tutorial/focus-fr-dark.webp"),
  "focus-es-light.webp": require("../assets/tutorial/focus-es-light.webp"),
  "focus-es-dark.webp": require("../assets/tutorial/focus-es-dark.webp"),
  "health-it-light.webp": require("../assets/tutorial/health-it-light.webp"),
  "health-it-dark.webp": require("../assets/tutorial/health-it-dark.webp"),
  "health-en-light.webp": require("../assets/tutorial/health-en-light.webp"),
  "health-en-dark.webp": require("../assets/tutorial/health-en-dark.webp"),
  "health-fr-light.webp": require("../assets/tutorial/health-fr-light.webp"),
  "health-fr-dark.webp": require("../assets/tutorial/health-fr-dark.webp"),
  "health-es-light.webp": require("../assets/tutorial/health-es-light.webp"),
  "health-es-dark.webp": require("../assets/tutorial/health-es-dark.webp"),
  "notifications-it-light.webp": require("../assets/tutorial/notifications-it-light.webp"),
  "notifications-it-dark.webp": require("../assets/tutorial/notifications-it-dark.webp"),
  "notifications-en-light.webp": require("../assets/tutorial/notifications-en-light.webp"),
  "notifications-en-dark.webp": require("../assets/tutorial/notifications-en-dark.webp"),
  "notifications-fr-light.webp": require("../assets/tutorial/notifications-fr-light.webp"),
  "notifications-fr-dark.webp": require("../assets/tutorial/notifications-fr-dark.webp"),
  "notifications-es-light.webp": require("../assets/tutorial/notifications-es-light.webp"),
  "notifications-es-dark.webp": require("../assets/tutorial/notifications-es-dark.webp"),
};

export function shotSource(shot: TutorialShot, locale: Locale, scheme: ThemeScheme): ImageSourcePropType {
  return SOURCES[shotAssetName(shot, locale, scheme)] ?? SOURCES[shotAssetName(shot, "it", scheme)]!;
}
