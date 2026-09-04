// Icona di notifica Android per expo-notifications: 96×96, BIANCA su
// TRASPARENTE. Android nella status bar usa solo il canale alpha e la tinge
// col `color` del plugin, quindi la geometria deve reggere a 24dp: qui c'è
// il volto della v2 (brain-icon.source.mjs:50-60 — occhiali, occhio aperto
// con pupilla, occhio strizzato, sorriso) senza cervello né cartella.
//
// Uso — sharp NON è in package.json, si installa al volo e si toglie subito
// (npm prune rimuove ciò che non è nel lockfile, come per react-native-web
// in docs/TROUBLESHOOTING.md § Runtime version mismatch):
//   npm install --no-save sharp
//   node assets/brand/icon-v2/notification-icon.source.mjs
//   npm prune --legacy-peer-deps
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WHITE = "#FFFFFF";
const stroke = (d, w) =>
  `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Contenuto dentro 8..88 su entrambi gli assi (2dp di margine a 24dp).
const svg = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <!-- occhiali -->
  <circle cx="30" cy="38" r="15" fill="none" stroke="${WHITE}" stroke-width="7"/>
  <circle cx="66" cy="38" r="15" fill="none" stroke="${WHITE}" stroke-width="7"/>
  ${stroke("M 45 38 Q 48 32 51 38", 6)}
  ${stroke("M 15 36 L 8 33", 6)}
  ${stroke("M 81 36 L 88 33", 6)}
  <!-- occhio aperto con pupilla, occhio strizzato -->
  <circle cx="30" cy="39" r="6" fill="${WHITE}"/>
  ${stroke("M 59 39 Q 66 32 73 39", 6)}
  <!-- sorriso -->
  ${stroke("M 38 64 Q 48 74 58 64", 7)}
</svg>`;

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../notification-icon.png");
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("scritto", out);
