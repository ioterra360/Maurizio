// Memika app icon v2 — "il cervello E' il quadrato". Iconic brain cues:
// big lobes at the top edge, central hemispheric fissure, fat gyri loops.
import sharp from "sharp";

const PINK = "#F8D2C4";        // base
const PINK_DEEP = "#EDA98F";   // gyri strokes
const PINK_DARK = "#E2917A";   // bump shadows / lower band
const NAVY = "#1E2B4F";
const WHITE = "#FFFFFF";
const CREAM = "#FDF3EC";       // lens fill

const stroke = (d, w, color, opacity = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;

// Top bumps: big overlapping lobe circles, deeper pink, cropped by the square.
const bump = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PINK}" stroke="${PINK_DEEP}" stroke-width="26"/>`;

const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${PINK_DEEP}"/>
  <!-- lobes: a bumpy crown along the top, then the base pink floods the rest -->
  ${bump(90, 150, 150)}
  ${bump(310, 105, 165)}
  ${bump(540, 130, 170)}
  ${bump(760, 100, 160)}
  ${bump(950, 160, 150)}
  <rect y="235" width="1024" height="789" fill="${PINK}"/>
  <!-- side bumps hugging left/right edges -->
  <circle cx="18" cy="430" r="120" fill="${PINK}" stroke="${PINK_DEEP}" stroke-width="26"/>
  <circle cx="1006" cy="430" r="120" fill="${PINK}" stroke="${PINK_DEEP}" stroke-width="26"/>
  <circle cx="14" cy="700" r="130" fill="${PINK}" stroke="${PINK_DEEP}" stroke-width="26"/>
  <circle cx="1010" cy="700" r="130" fill="${PINK}" stroke="${PINK_DEEP}" stroke-width="26"/>
  <!-- cover circle-strokes inside the face zone -->
  <rect x="120" y="300" width="784" height="560" fill="${PINK}"/>

  <!-- central fissure: parts the hemispheres, ends above the glasses -->
  ${stroke("M 512 8 q -42 60 6 118 q 46 56 -8 122", 40, PINK_DEEP)}

  <!-- fat gyri loops, sparse and symmetric-ish -->
  ${stroke("M 150 250 q 60 -70 140 -20 q 66 42 140 -8", 42, PINK_DEEP)}
  ${stroke("M 600 240 q 76 -56 150 -6 q 60 40 130 0", 42, PINK_DEEP)}
  ${stroke("M 60 880 q 90 -64 190 -12", 42, PINK_DEEP)}
  ${stroke("M 770 880 q 90 -62 190 -6", 42, PINK_DEEP)}
  ${stroke("M 330 940 q 90 -58 180 -6 q 84 46 180 -14", 42, PINK_DEEP)}

  <!-- soft base shading -->
  ${stroke("M 30 1024 Q 512 900 994 1024", 90, PINK_DARK, 0.5)}

  <!-- face -->
  <g>
    <circle cx="352" cy="540" r="152" fill="${CREAM}" stroke="${NAVY}" stroke-width="32"/>
    <circle cx="672" cy="540" r="152" fill="${CREAM}" stroke="${NAVY}" stroke-width="32"/>
    <path d="M 500 540 Q 512 498 524 540" fill="none" stroke="${NAVY}" stroke-width="28" stroke-linecap="round"/>
    <path d="M 200 522 L 112 494" stroke="${NAVY}" stroke-width="28" stroke-linecap="round"/>
    <path d="M 824 522 L 912 494" stroke="${NAVY}" stroke-width="28" stroke-linecap="round"/>
    <circle cx="352" cy="548" r="64" fill="${NAVY}"/>
    <circle cx="328" cy="524" r="21" fill="${WHITE}"/>
    <path d="M 608 548 Q 672 500 736 548" fill="none" stroke="${NAVY}" stroke-width="32" stroke-linecap="round"/>
    <path d="M 458 764 Q 512 818 566 764" fill="none" stroke="${NAVY}" stroke-width="30" stroke-linecap="round"/>
  </g>

  <!-- la cartella: spunta dal bordo in basso a destra, linguetta verde -->
  <g transform="translate(600 672) rotate(-5)">
    <!-- retro -->
    <path d="M 20 90 h 120 l 34 -44 h 150 a 26 26 0 0 1 26 26 v 260 h -330 z"
          fill="#3FA86B" stroke="${NAVY}" stroke-width="24" stroke-linejoin="round"/>
    <!-- fronte -->
    <path d="M -10 140 h 380 a 24 24 0 0 1 23 30 l -40 210 h -380 l -7 -212 a 26 26 0 0 1 24 -28 z"
          fill="${CREAM}" stroke="${NAVY}" stroke-width="24" stroke-linejoin="round"/>
    <!-- spunta verde sul fronte -->
    <path d="M 70 250 l 42 40 l 78 -80" fill="none" stroke="#3FA86B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("brain-square.png");

const rounded = await sharp("brain-square.png")
  .composite([{ input: Buffer.from(`<svg width="1024" height="1024"><rect width="1024" height="1024" rx="230" fill="#fff"/></svg>`), blend: "dest-in" }])
  .png().toBuffer();
await sharp({ create: { width: 1560, height: 620, channels: 4, background: "#f2efe9" } })
  .composite([
    { input: await sharp(rounded).resize(520, 520).toBuffer(), left: 40, top: 50 },
    { input: await sharp(rounded).resize(320, 320).toBuffer(), left: 640, top: 150 },
    { input: await sharp(rounded).resize(120, 120).toBuffer(), left: 1040, top: 250 },
  ])
  .png().toFile("brain-preview.png");
console.log("v2 done");
