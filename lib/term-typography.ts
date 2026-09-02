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
 * Model: advance PER GLIFO estratte dall'Inter_700Bold.ttf davvero spedito
 * (2026-09-02, script in fondo alla history del commit) — la vecchia media
 * per classe (minuscole = 0.58 em) sottostimava le parole con m/w del ~8%
 * ("embargo" reale 4.19 em contro 3.88 stimati) e le faceva spezzare a metà
 * ("embarg / o", segnalato da Maurizio). CJK = quadrato; caratteri ignoti =
 * base NFD se nota, altrimenti fallback per classe; il tracking negativo
 * (-0.03 em a carattere) è sottratto.
 *
 * Regola prodotto (Maurizio 2026-09-01): una parola singola sta su UNA riga
 * — la taglia scende fino a FLOOR_SINGLE_WORD (24) pur di non spezzarla; il
 * caso limite (12 × 'm' = 10.63 em) a 24 px occupa 255 px e sta nella
 * scatola più stretta che supportiamo (320 dp → 256 px). Solo una parola
 * che non entra nemmeno a 24 può andare a capo. Un termine multi-parola può
 * avvolgere su due righe, limitato dalla parola più lunga, da metà della
 * larghezza totale e dal 75% del massimo del layer.
 */

const FLOOR = 28;
/** Sotto questa taglia non si scende PER EVITARE l'a-capo: meglio spezzare che rendere illeggibile. */
const FLOOR_SINGLE_WORD = 24;
// A two-word term at the layer maximum would take two 92 px lines (184 dp)
// in a column that does not scroll; three quarters keeps it big but leaves
// room for the reveal panel on 640 dp phones.
const MULTI_WORD_MAX_RATIO = 0.75;
const TRACKING_EM = -0.03;
const LINE_HEIGHT_RATIO = 1.1;

// CJK unified ideographs, kana and full-width forms.
const CJK = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

// Advance reali di Inter Bold in em (advance/unitsPerEm, 3 decimali),
// estratte da node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf.
// prettier-ignore
const ADVANCE: Record<string, number> = {
  a: 0.581, b: 0.63, c: 0.588, d: 0.63, e: 0.596, f: 0.398, g: 0.632, h: 0.623,
  i: 0.271, j: 0.271, k: 0.58, l: 0.271, m: 0.913, n: 0.623, o: 0.613, p: 0.63,
  q: 0.63, r: 0.407, s: 0.56, t: 0.366, u: 0.623, v: 0.6, w: 0.85, x: 0.58,
  y: 0.602, z: 0.573,
  A: 0.747, B: 0.662, C: 0.74, D: 0.722, E: 0.607, F: 0.587, G: 0.75, H: 0.747,
  I: 0.281, J: 0.584, K: 0.719, L: 0.565, M: 0.932, N: 0.762, O: 0.771, P: 0.648,
  Q: 0.777, R: 0.657, S: 0.655, T: 0.667, U: 0.732, V: 0.747, W: 1.038, X: 0.738,
  Y: 0.731, Z: 0.664,
  "0": 0.674, "1": 0.431, "2": 0.63, "3": 0.646, "4": 0.676, "5": 0.622,
  "6": 0.649, "7": 0.582, "8": 0.651, "9": 0.649,
  " ": 0.237, ".": 0.334, ",": 0.334, ";": 0.343, ":": 0.334, "'": 0.339,
  "’": 0.311, '"': 0.552, "!": 0.338, "?": 0.56, "(": 0.377, ")": 0.377,
  "-": 0.468, "–": 0.5,
  à: 0.581, á: 0.581, â: 0.581, ä: 0.581, ã: 0.581, å: 0.581,
  è: 0.596, é: 0.596, ê: 0.596, ë: 0.596, ì: 0.271, í: 0.271, î: 0.271, ï: 0.271,
  ò: 0.613, ó: 0.613, ô: 0.613, ö: 0.613, õ: 0.613,
  ù: 0.623, ú: 0.623, û: 0.623, ü: 0.623, ý: 0.602, ñ: 0.623, ç: 0.588,
  ø: 0.613, œ: 0.988, æ: 0.91, ß: 0.657,
  À: 0.747, Á: 0.747, Â: 0.747, Ä: 0.747, Ã: 0.747, Å: 0.747,
  È: 0.607, É: 0.607, Ê: 0.607, Ë: 0.607, Ì: 0.281, Í: 0.281, Î: 0.281, Ï: 0.281,
  Ò: 0.771, Ó: 0.771, Ô: 0.771, Ö: 0.771, Õ: 0.771,
  Ù: 0.732, Ú: 0.732, Û: 0.732, Ü: 0.732, Ñ: 0.762, Ç: 0.74,
  Ø: 0.771, Œ: 1.018, Æ: 1.022,
};

function unitOf(ch: string): number {
  const exact = ADVANCE[ch];
  if (exact !== undefined) return exact;
  if (CJK.test(ch)) return 1.0;
  // Carattere accentato non in tabella: la base NFD ha la stessa advance.
  const base = ch.normalize("NFD")[0];
  if (base !== undefined && ADVANCE[base] !== undefined) return ADVANCE[base];
  if (/\s/.test(ch)) return 0.3;
  if (/\d/.test(ch)) return 0.674; // la cifra piu' larga, prudente
  if (/\p{Lu}/u.test(ch)) return 0.78;
  if (/\p{Ll}/u.test(ch)) return 0.65;
  return 0.7;
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
  const longest = Math.max(...words.map(widthUnits));
  const byWord = boxWidth / longest;

  if (words.length === 1) {
    // Parola singola: UNA riga, scendendo fino a FLOOR_SINGLE_WORD pur di
    // non spezzarla (Maurizio 2026-09-01: intera fino a 12 lettere).
    const singleFloor = Math.min(floor, FLOOR_SINGLE_WORD);
    if (byWord >= singleFloor) {
      return Math.max(singleFloor, Math.floor(Math.min(max, byWord)));
    }
    // Patologica (non entra nemmeno al floor): si concede l'a-capo e si
    // dimensiona sulla larghezza totale distribuita su due righe.
    const byTotal = (2 * boxWidth) / widthUnits(trimmed);
    return Math.max(floor, Math.floor(Math.min(max, byTotal)));
  }

  const ceiling = Math.floor(max * MULTI_WORD_MAX_RATIO);
  const byTotal = (2 * boxWidth) / widthUnits(trimmed);
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
 * Lines the term may occupy at `size`. Una parola singola che entra nella
 * riga alla taglia scelta prende numberOfLines={1}: è QUESTO che impedisce
 * a React Native di considerare "embarg / o" un fit valido — con 2 righe
 * concesse il fitter nativo non rimpicciolisce mai (minimumFontScale è
 * ignorato sotto la New Architecture). Solo una parola patologica, che non
 * entra nemmeno al floor, riceve più righe. Un termine multi-parola prende
 * le righe che la sua larghezza stimata richiede, da 2 a 4.
 */
export function termLines(term: string, boxWidth: number, size: number): number {
  const trimmed = term.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (boxWidth <= 0) return MIN_LINES;
  if (words.length <= 1) {
    // Tolleranza dell'1% sugli arrotondamenti della piattaforma.
    if (widthUnits(trimmed) * size <= boxWidth * 1.01) return 1;
    const needed = Math.ceil((widthUnits(trimmed) * size) / boxWidth);
    return Math.min(MAX_LINES, Math.max(MIN_LINES, needed));
  }
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
