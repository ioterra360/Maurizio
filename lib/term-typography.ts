/**
 * Width-aware type size for the review term (the big word on Scan,
 * Reinforcement and Focus). Pure: same inputs, same size — testable in
 * lib/term-typography.test.ts.
 *
 * Why not adjustsFontSizeToFit alone: under the New Architecture
 * `minimumFontScale` is ignored and the Android fitter both over-shrinks and
 * sometimes does not shrink at all (see app/(app)/today.tsx hero note), so on
 * a 360 dp phone an 84 px Inter Bold term showed about six letters before
 * clipping ("sendero" is 321 px wide in a 296 px box). We size the term from
 * the string itself so it fits by construction; the native fitter stays on
 * as a safety net.
 *
 * Model: Inter Bold average advances in em (lowercase 0.563 measured, rounded
 * up for safety), CJK glyphs are square, and the negative tracking we apply
 * (-0.03 em per character) is subtracted. A single word must fit one line; a
 * multi-word term may wrap to two lines, so it is bounded by its longest word,
 * by half its total width and by 75% of the layer maximum.
 */

const FLOOR = 28;
// A two-word term at the layer maximum would take two 92 px lines (184 dp)
// in a column that does not scroll; three quarters keeps it big but leaves
// room for the reveal panel on 640 dp phones.
const MULTI_WORD_MAX_RATIO = 0.75;
const TRACKING_EM = -0.03;
const LINE_HEIGHT_RATIO = 1.1;

// CJK unified ideographs, kana and full-width forms.
const CJK = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

function unitOf(ch: string): number {
  if (CJK.test(ch)) return 1.0;
  if (/\s/.test(ch)) return 0.3;
  if (/\d/.test(ch)) return 0.6;
  if (/[.,;:'’"!?()\-–]/.test(ch)) return 0.35;
  if (/\p{Lu}/u.test(ch)) return 0.68;
  if (/\p{Ll}/u.test(ch)) return 0.58;
  return 0.62;
}

/** Estimated width of `text` in em at 1 px, tracking included. */
function widthUnits(text: string): number {
  let units = 0;
  for (const ch of text) units += unitOf(ch);
  return units + TRACKING_EM * Math.max(0, [...text].length - 1);
}

/**
 * Largest font size (px, whole number) at which `term` fits `boxWidth`:
 * one line for a single word, up to two lines for a multi-word term. Never
 * above `max`, never below the readable floor (default 28, override per surface).
 */
export function termFontSize(term: string, boxWidth: number, max: number, floor: number = FLOOR): number {
  const trimmed = term.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || boxWidth <= 0) return max;
  const multi = words.length > 1;
  const ceiling = multi ? Math.floor(max * MULTI_WORD_MAX_RATIO) : max;
  const longest = Math.max(...words.map(widthUnits));
  const byWord = boxWidth / longest;
  const byTotal = multi ? (2 * boxWidth) / widthUnits(trimmed) : byWord;
  const size = Math.min(ceiling, byWord, byTotal);
  return Math.max(floor, Math.floor(size));
}

/**
 * Largest whole font size at which `text` fits ONE line of `boxWidth`,
 * clamped to [floor, max]. For single-line rows (folder list, item rows)
 * where the text must shrink to stay whole before the ellipsis is allowed
 * to cut it (Maurizio, 2026-08-30 — "embarg…" clipped).
 */
export function lineFontSize(text: string, boxWidth: number, max: number, floor: number): number {
  const trimmed = text.trim();
  if (trimmed.length === 0 || boxWidth <= 0) return max;
  const size = boxWidth / widthUnits(trimmed);
  return Math.max(floor, Math.min(max, Math.floor(size)));
}

const MIN_LINES = 2;
const MAX_LINES = 4;

/**
 * Lines the term may occupy at `size`: two for a single word (a mid-word
 * wrap of a pathological word beats clipping; the native fitter shrinks it),
 * and for a multi-word term as many as its estimated width needs, up to
 * four, so a long phrase at the floor is still shown in full.
 */
export function termLines(term: string, boxWidth: number, size: number): number {
  const trimmed = term.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1 || boxWidth <= 0) return MIN_LINES;
  const needed = Math.ceil((widthUnits(trimmed) * size) / boxWidth);
  return Math.min(MAX_LINES, Math.max(MIN_LINES, needed));
}

/** Line height with room for ascenders/descenders (Android clips below ~1.1). */
export function termLineHeight(size: number): number {
  return Math.round(size * LINE_HEIGHT_RATIO);
}

/** Tracking in px for a given size (the -0.03 em the width model assumes). */
export function termLetterSpacing(size: number): number {
  return Math.round(size * TRACKING_EM * 100) / 100;
}
