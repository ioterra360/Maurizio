// Screenshot VERI dell'app per il tutorial di benvenuto (app/tutorial.tsx),
// per lingua e per tema, dall'app in DEMO su Expo web con Playwright.
// Stessa pipeline degli screenshot per gli store (scripts/store-screenshots,
// leggi il README li' per l'installazione dei pacchetti web e per la trappola
// del fingerprint: `npm prune --legacy-peer-deps` PRIMA di qualunque build).
//
//   EXPO_PUBLIC_DEMO_MODE=true CI=1 BROWSER=none npx expo start --web --port 8092
//   node scripts/tutorial-shots/capture.cjs [baseUrl]
//   python scripts/tutorial-shots/convert.py      # -> assets/tutorial/*.webp
//
// Output grezzo: scripts/tutorial-shots/raw/<lingua>-<tema>/<nome>.png
// (412x915 CSS px @3x). Lingua = locale del browser (lib/i18n), tema = la
// preferenza "memika.theme" in localStorage (theme/theme-store.ts).
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");

const BASE = process.argv[2] || "http://localhost:8092";
const LOCALES = { it: "it-IT", en: "en-US", fr: "fr-FR", es: "es-ES" };
const THEMES = ["light", "dark"];
const ONLY = (process.env.SHOT_ONLY || "").split(",").filter(Boolean); // es. SHOT_ONLY=it-light
const NAMES = (process.env.SHOT_NAMES || "").split(",").filter(Boolean); // es. SHOT_NAMES=notifications
const FIXED_TIME = new Date("2026-09-08T09:41:00+02:00"); // mattina: "Buongiorno", data stabile
const W = 412;
const H = 915;

// Etichette dei bottoni: si cercano per valore italiano e si traducono dal catalogo.
const parseCatalog = (lang) =>
  Object.fromEntries(
    [...fs.readFileSync(path.join(__dirname, "..", "..", "lib", "i18n", `${lang}.ts`), "utf8")
      .matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((m) => [m[1], m[2]]),
  );
const IT = parseCatalog("it");
const CATALOGS = { it: IT, en: parseCatalog("en"), fr: parseCatalog("fr"), es: parseCatalog("es") };
const label = (lang, itValue) => {
  const key = Object.keys(IT).find((k) => IT[k] === itValue);
  return key ? CATALOGS[lang][key] : itValue;
};
const labelByKey = (lang, key) => CATALOGS[lang][key] ?? IT[key];

// Le sei schermate del tutorial. `taps` sono etichette italiane.
const SHOTS = [
  { name: "today", route: "/today" },
  { name: "knowledge", route: "/knowledge" },
  // Il bottone + della cartella e' solo icona: si trova per etichetta di accessibilita'.
  { name: "add", route: "/folder/demo-folder-es", taps: [{ a11yKey: "folder.fabAddA11y" }] },
  { name: "focus", route: "/review/focus", taps: [{ text: "Mostra risposta" }] },
  { name: "health", route: "/health" },
  { name: "notifications", route: "/notifications" },
];

async function captureSet(browser, lang, theme) {
  const out = path.join(__dirname, "raw", `${lang}-${theme}`);
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: LOCALES[lang],
    timezoneId: "Europe/Rome",
    colorScheme: theme,
  });
  await ctx.clock.install({ time: FIXED_TIME });
  // La preferenza esplicita vince sul sistema (theme-store): cosi' il tema e'
  // quello chiesto anche se il browser headless non onora colorScheme.
  await ctx.addInitScript((t) => {
    window.localStorage.setItem("memika.theme", t);
    // Il tutorial (una volta per dispositivo) si sovrapporrebbe a ogni
    // schermata: qui e' gia' "visto".
    window.localStorage.setItem("memika.tutorial.v1", JSON.stringify({ seen: true }));
  }, theme);
  const page = await ctx.newPage();
  const tap = (text) => page.getByText(text, { exact: true }).first().click();

  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(() => document.body.innerText.includes("Angelo Casula"), null, { timeout: 240000 });
  await tap("Angelo Casula");
  await page.waitForTimeout(400);
  await tap(label(lang, "Accedi"));
  await page.waitForFunction(() => location.pathname === "/today" || location.pathname === "/tutorial", null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  for (const s of SHOTS) {
    if (NAMES.length && !NAMES.includes(s.name)) continue;
    await page.goto(`${BASE}${s.route}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(3000);
    for (const t of s.taps ?? []) {
      if (t.a11yKey) await page.getByLabel(labelByKey(lang, t.a11yKey)).first().click();
      else await tap(label(lang, t.text));
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(out, `${s.name}.png`) });
    console.log("captured", lang, theme, s.name);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const lang of Object.keys(LOCALES)) {
    for (const theme of THEMES) {
      if (ONLY.length && !ONLY.includes(`${lang}-${theme}`)) continue;
      await captureSet(browser, lang, theme);
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
