/**
 * Coach tips — short, evidence-based suggestions delivered by the Memika
 * mascot in a speech bubble. Two pools:
 *
 *   - `general` : tips about memory science in general (study habits, sleep,
 *     spacing, retrieval practice). Surfaced anywhere when no context tip
 *     applies. Sourced from peer-reviewed memory research — citations live
 *     alongside each tip.
 *   - `screen`  : tips tied to a specific screen, surfaced when the user
 *     lands on that screen for the first time (or after a long absence).
 *
 * Sources frequently referenced:
 *   - Karpicke & Roediger (2008) — testing effect, Science.
 *   - Cepeda et al. (2008) — spacing effect, Psychological Science.
 *   - Ebbinghaus (1885) — forgetting curve.
 *   - Walker (2017) "Why We Sleep" — sleep and consolidation.
 *   - Bjork & Bjork (2011) — desirable difficulties.
 *
 * Copy lives in the i18n catalog (`coachTips.*`). Each tip's text fields are
 * getters resolving `t()` at access time, so a language switch applies at
 * once and nothing translated is cached at module load.
 */

import { t, type TKey } from "@/lib/i18n";

export type CoachTip = {
  id: string;
  title: string;
  body: string;
  /** Optional source citation shown small under the body. */
  source?: string;
};

/**
 * Build a tip whose `title` / `body` / `source` resolve through `t()` on every
 * read (the object stays a plain `CoachTip`; `source` is only defined when a
 * citation key is given, matching the previous literal shape).
 */
function defineTip(id: string, titleKey: TKey, bodyKey: TKey, sourceKey?: TKey): CoachTip {
  const tip: CoachTip = {
    id,
    get title() {
      return t(titleKey);
    },
    get body() {
      return t(bodyKey);
    },
  };
  if (sourceKey) {
    Object.defineProperty(tip, "source", {
      enumerable: true,
      get: () => t(sourceKey),
    });
  }
  return tip;
}

export const GENERAL_TIPS: CoachTip[] = [
  defineTip(
    "gen.spacing",
    "coachTips.genSpacingTitle",
    "coachTips.genSpacingBody",
    "coachTips.genSpacingSource",
  ),
  defineTip(
    "gen.testing",
    "coachTips.genTestingTitle",
    "coachTips.genTestingBody",
    "coachTips.genTestingSource",
  ),
  defineTip(
    "gen.sleep",
    "coachTips.genSleepTitle",
    "coachTips.genSleepBody",
    "coachTips.genSleepSource",
  ),
  defineTip(
    "gen.forgetting-curve",
    "coachTips.genForgettingCurveTitle",
    "coachTips.genForgettingCurveBody",
    "coachTips.genForgettingCurveSource",
  ),
  defineTip(
    "gen.desirable-difficulty",
    "coachTips.genDesirableDifficultyTitle",
    "coachTips.genDesirableDifficultyBody",
    "coachTips.genDesirableDifficultySource",
  ),
  defineTip(
    "gen.context",
    "coachTips.genContextTitle",
    "coachTips.genContextBody",
    "coachTips.genContextSource",
  ),
  defineTip(
    "gen.elaborate",
    "coachTips.genElaborateTitle",
    "coachTips.genElaborateBody",
    "coachTips.genElaborateSource",
  ),
  defineTip(
    "gen.health",
    "coachTips.genHealthTitle",
    "coachTips.genHealthBody",
    "coachTips.genHealthSource",
  ),
];

/**
 * Subject categories. Each Memika folder maps onto one of these — the
 * `categoryOfFolder` table at the bottom resolves a folder kind to its
 * category, falling back to "generic" if unknown.
 */
export type StudyCategory =
  | "languages"
  | "math"
  | "history"
  | "medicine"
  | "law"
  | "science"
  | "art"
  | "code"
  | "generic";

export const CATEGORY_TIPS: Record<StudyCategory, CoachTip[]> = {
  languages: [
    defineTip(
      "lang.shadowing",
      "coachTips.langShadowingTitle",
      "coachTips.langShadowingBody",
      "coachTips.langShadowingSource",
    ),
    defineTip("lang.context", "coachTips.langContextTitle", "coachTips.langContextBody"),
    defineTip(
      "lang.daily",
      "coachTips.langDailyTitle",
      "coachTips.langDailyBody",
      "coachTips.langDailySource",
    ),
    defineTip(
      "lang.errors",
      "coachTips.langErrorsTitle",
      "coachTips.langErrorsBody",
      "coachTips.langErrorsSource",
    ),
  ],
  math: [
    defineTip(
      "math.spaced-problems",
      "coachTips.mathSpacedProblemsTitle",
      "coachTips.mathSpacedProblemsBody",
      "coachTips.mathSpacedProblemsSource",
    ),
    defineTip("math.explain", "coachTips.mathExplainTitle", "coachTips.mathExplainBody"),
    // Same citation as gen.testing (Karpicke & Roediger, 2008) — key reused.
    defineTip(
      "math.retrieval",
      "coachTips.mathRetrievalTitle",
      "coachTips.mathRetrievalBody",
      "coachTips.genTestingSource",
    ),
  ],
  history: [
    defineTip("hist.timeline", "coachTips.histTimelineTitle", "coachTips.histTimelineBody"),
    defineTip(
      "hist.story",
      "coachTips.histStoryTitle",
      "coachTips.histStoryBody",
      "coachTips.histStorySource",
    ),
    defineTip(
      "hist.places",
      "coachTips.histPlacesTitle",
      "coachTips.histPlacesBody",
      "coachTips.histPlacesSource",
    ),
  ],
  medicine: [
    defineTip("med.mnemonic", "coachTips.medMnemonicTitle", "coachTips.medMnemonicBody"),
    defineTip(
      "med.cases",
      "coachTips.medCasesTitle",
      "coachTips.medCasesBody",
      "coachTips.medCasesSource",
    ),
    defineTip("med.spaced-anki", "coachTips.medSpacedAnkiTitle", "coachTips.medSpacedAnkiBody"),
  ],
  law: [
    defineTip("law.irac", "coachTips.lawIracTitle", "coachTips.lawIracBody"),
    defineTip("law.outline", "coachTips.lawOutlineTitle", "coachTips.lawOutlineBody"),
    defineTip("law.cases", "coachTips.lawCasesTitle", "coachTips.lawCasesBody"),
  ],
  science: [
    defineTip(
      "sci.diagrams",
      "coachTips.sciDiagramsTitle",
      "coachTips.sciDiagramsBody",
      "coachTips.sciDiagramsSource",
    ),
    defineTip("sci.connect", "coachTips.sciConnectTitle", "coachTips.sciConnectBody"),
  ],
  art: [
    defineTip("art.attribution", "coachTips.artAttributionTitle", "coachTips.artAttributionBody"),
  ],
  code: [
    defineTip(
      "code.recall-syntax",
      "coachTips.codeRecallSyntaxTitle",
      "coachTips.codeRecallSyntaxBody",
    ),
    defineTip(
      "code.read-good-code",
      "coachTips.codeReadGoodCodeTitle",
      "coachTips.codeReadGoodCodeBody",
    ),
  ],
  generic: [
    defineTip("gen.start-easy", "coachTips.genStartEasyTitle", "coachTips.genStartEasyBody"),
  ],
};

/**
 * Map between a Memika folder kind and a study category. Add new mappings
 * here when a new folder kind is introduced.
 */
const FOLDER_TO_CATEGORY: Record<string, StudyCategory> = {
  jp: "languages",
  es: "languages",
  medicine: "medicine",
  law: "law",
  math: "math",
  history: "history",
  science: "science",
  art: "art",
  code: "code",
};

export function categoryOfFolder(folderKind: string | null | undefined): StudyCategory {
  if (!folderKind) return "generic";
  return FOLDER_TO_CATEGORY[folderKind] ?? "generic";
}

/**
 * Pick a tip tailored to the folder/category being reviewed. Falls back to
 * general memory science when the category has no tips configured.
 */
export function pickCategoryTip(
  folderKind: string | null | undefined,
  version: number,
): CoachTip {
  const cat = categoryOfFolder(folderKind);
  const pool = CATEGORY_TIPS[cat]?.length ? CATEGORY_TIPS[cat] : GENERAL_TIPS;
  const idx = Math.abs(version) % pool.length;
  return pool[idx];
}

export const SCREEN_TIPS: Record<string, CoachTip[]> = {
  today: [
    defineTip("today.flow", "coachTips.todayFlowTitle", "coachTips.todayFlowBody"),
    defineTip("today.budget", "coachTips.todayBudgetTitle", "coachTips.todayBudgetBody"),
  ],
  knowledge: [
    defineTip(
      "knowledge.priority",
      "coachTips.knowledgePriorityTitle",
      "coachTips.knowledgePriorityBody",
    ),
    defineTip(
      "knowledge.categories",
      "coachTips.knowledgeCategoriesTitle",
      "coachTips.knowledgeCategoriesBody",
      "coachTips.knowledgeCategoriesSource",
    ),
  ],
  health: [
    defineTip(
      "health.attention",
      "coachTips.healthAttentionTitle",
      "coachTips.healthAttentionBody",
    ),
  ],
  add: [defineTip("add.short", "coachTips.addShortTitle", "coachTips.addShortBody")],
};

/**
 * Stable but rotated pick — given a screen and a "version" (e.g. the day
 * number), return a tip that changes over time without being random on every
 * mount. Falls back to general tips if the screen has none configured.
 */
export function pickTip(screen: string, version: number): CoachTip {
  const pool = SCREEN_TIPS[screen]?.length ? SCREEN_TIPS[screen] : GENERAL_TIPS;
  const idx = Math.abs(version) % pool.length;
  return pool[idx];
}

export function pickGeneralTip(version: number): CoachTip {
  const idx = Math.abs(version) % GENERAL_TIPS.length;
  return GENERAL_TIPS[idx];
}
