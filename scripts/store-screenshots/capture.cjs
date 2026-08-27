// Captures raw phone screenshots of the app running on Expo web in DEMO mode.
// See README.md in this folder for the full recipe (and the fingerprint gotcha).
//
//   node scripts/store-screenshots/capture.cjs [baseUrl]
//   SHOT_LOCALE=en node scripts/store-screenshots/capture.cjs   # English UI → raw-en/
//
// Output: scripts/store-screenshots/raw[-<locale>]/<name>.png (412x{915|680} CSS px @3x).
// The app picks its language from the browser locale (lib/i18n), so the
// Playwright context locale is what switches the UI.
const path = require("path");
const { chromium } = require("playwright-core");

const BASE = process.argv[2] || "http://localhost:8091";
const LOCALE = (process.env.SHOT_LOCALE || "it").toLowerCase();
const CONTEXT_LOCALE = { it: "it-IT", en: "en-US", fr: "fr-FR", es: "es-ES" }[LOCALE] || "it-IT";
// Button labels come from the catalogs, looked up by the Italian value, so
// new languages need no edits here.
const fs = require("fs");
const parseCatalog = (lang) => Object.fromEntries([...fs.readFileSync(path.join(__dirname, "..", "..", "lib", "i18n", `${lang}.ts`), "utf8").matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((m) => [m[1], m[2]]));
const IT = parseCatalog("it");
const TARGET = LOCALE === "it" ? IT : parseCatalog(LOCALE);
const L = (itValue) => { const key = Object.keys(IT).find((k) => IT[k] === itValue); return key ? TARGET[key] : itValue; };
const OUT = path.join(__dirname, LOCALE === "it" ? "raw" : `raw-${LOCALE}`);
const FIXED_TIME = new Date("2026-08-27T09:41:00+02:00"); // morning greeting, stable date badge
const W = 412;

// height 680 = bottom-pinned review actions fit inside the visible part of the frame.
const SHOTS = [
  { name: "today", route: "/today" },
  { name: "knowledge", route: "/knowledge" },
  { name: "health", route: "/health" },
  { name: "folder-es", route: "/folder/es" },
  { name: "add", route: "/folder/es", taps: ["Aggiungi"] }, // /add only opens via an intentional tap (lib/add-gate.ts)
  { name: "scan", route: "/review/scan", taps: ["Mostrami"], height: 680 },
  { name: "reinforcement", route: "/review/reinforcement", taps: ["Dammi un indizio"], height: 680 },
  { name: "focus", route: "/review/focus", taps: ["Mostra risposta"], height: 680 },
];

async function newContext(browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: CONTEXT_LOCALE,
    timezoneId: "Europe/Rome",
  });
  await ctx.clock.install({ time: FIXED_TIME });
  return ctx;
}
const tap = (page, text) => page.getByText(text, { exact: true }).first().click();

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  require("fs").mkdirSync(OUT, { recursive: true });

  // Logged-out: onboarding hero (the auth gate only renders it without a session).
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/onboarding`, { waitUntil: "load", timeout: 240000 });
    await page.waitForFunction(() => document.body.innerText.length > 40, null, { timeout: 240000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, "onboarding-welcome.png") });
    await ctx.close();
  }

  // Logged-in demo user.
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(() => document.body.innerText.includes("Angelo Casula"), null, { timeout: 240000 });
  await tap(page, "Angelo Casula");
  await page.waitForTimeout(400);
  await tap(page, L("Accedi"));
  await page.waitForFunction(() => location.pathname === "/today", null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  for (const s of SHOTS) {
    await page.setViewportSize({ width: W, height: s.height ?? 915 });
    await page.goto(`${BASE}${s.route}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(3000);
    for (const t of s.taps ?? []) {
      await tap(page, L(t));
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
    console.log("captured", s.name);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
