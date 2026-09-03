#!/usr/bin/env node
// Verifica la configurazione nativa RISOLTA della build 3.
//
// Uso:
//   npx expo config --type introspect --json > "$TMP/introspect.json"
//   node scripts/native-config/check-introspect.cjs "$TMP/introspect.json"
//
// Legge quello che i plugin hanno scritto (Info.plist, entitlements,
// manifest Android, colors), non app.json: se un plugin non gira o gira con
// le opzioni sbagliate lo si vede qui, in un minuto, e non in una build EAS
// fallita dopo venti. Esce 1 al primo controllo rosso.
//
// NON copre la scrittura dei PNG in res/drawable-*: quella è un
// withDangerousMod (expo-notifications/plugin/build/withNotificationsAndroid.js:39-46)
// e l'introspezione lo salta. L'asset è coperto dal test vitest sull'IHDR
// (lib/native-config.test.ts).
"use strict";
const fs = require("node:fs");

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/native-config/check-introspect.cjs <introspect.json>");
  process.exit(2);
}
const c = JSON.parse(fs.readFileSync(file, "utf8"));

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}`);
  if (!cond) failed += 1;
}

const infoPlist = c.ios?.infoPlist ?? {};
const entitlements = c.ios?.entitlements ?? {};
const manifest = c._internal?.modResults?.android?.manifest?.manifest ?? {};
const usesPermission = (manifest["uses-permission"] ?? []).map((p) => p.$ ?? {});
const metaData = (manifest.application?.[0]?.["meta-data"] ?? []).map((m) => m.$?.["android:name"]);
const colors = Object.fromEntries(
  (c._internal?.modResults?.android?.colors?.resources?.color ?? []).map((x) => [x.$?.name, x._]),
);
const has = (name) => usesPermission.some((p) => p["android:name"] === name && p["tools:node"] !== "remove");
const removed = (name) => usesPermission.some((p) => p["android:name"] === name && p["tools:node"] === "remove");

// F1 — tema
check('userInterfaceStyle "automatic"', c.userInterfaceStyle === "automatic");
check('Info.plist UIUserInterfaceStyle = "Automatic"', infoPlist.UIUserInterfaceStyle === "Automatic");

// B5 — expo-image-picker
check(
  "NSCameraUsageDescription in italiano",
  infoPlist.NSCameraUsageDescription === "Memika usa la fotocamera per allegare immagini ai tuoi ricordi.",
);
check(
  "NSPhotoLibraryUsageDescription in italiano",
  infoPlist.NSPhotoLibraryUsageDescription === "Memika legge le tue foto per allegarle ai ricordi.",
);
check("nessuna NSMicrophoneUsageDescription", infoPlist.NSMicrophoneUsageDescription === undefined);
check("RECORD_AUDIO nel manifest solo come tools:node=remove", removed("android.permission.RECORD_AUDIO") && !has("android.permission.RECORD_AUDIO"));
check("CAMERA non bloccato", !removed("android.permission.CAMERA"));

// F3 — expo-notifications
check("aps-environment nelle entitlements", typeof entitlements["aps-environment"] === "string");
check("meta-data icona di notifica", metaData.includes("expo.modules.notifications.default_notification_icon"));
check("meta-data colore di notifica", metaData.includes("expo.modules.notifications.default_notification_color"));
check("notification_icon_color = #3B6BF5", String(colors.notification_icon_color ?? "").toUpperCase() === "#3B6BF5");

// B4 — RevenueCat
check("com.android.vending.BILLING dichiarato", has("com.android.vending.BILLING"));

// Icona v2
check("iconBackground = #F8D2C4", String(colors.iconBackground ?? "").toUpperCase() === "#F8D2C4");

// Le OPZIONI risolte dei plugin — NON `_internal.pluginHistory`: prebuild
// applica i plugin "unversioned" di expo-notifications e expo-image-picker
// anche senza voce in app.json (con opzioni vuote: è esattamente il bug che
// stiamo chiudendo), quindi `p in pluginHistory` è già vero oggi e non
// verificherebbe niente.
const entry = (name) => (c.plugins ?? []).find((p) => Array.isArray(p) && p[0] === name);
check(
  "expo-notifications con icon e color",
  entry("expo-notifications")?.[1]?.icon === "./assets/notification-icon.png" &&
    entry("expo-notifications")?.[1]?.color === "#3B6BF5",
);
check(
  "expo-image-picker con microphonePermission false",
  entry("expo-image-picker")?.[1]?.microphonePermission === false,
);
check("expo-splash-screen con la sua immagine", entry("expo-splash-screen")?.[1]?.image === "./assets/splash-icon.png");
check("expo-audio senza microfono", entry("expo-audio")?.[1]?.microphonePermission === false);

// Sentry: il token non deve MAI stare nel plugin (docs/DEPLOY.md § Sentry)
const sentry = entry("@sentry/react-native/expo");
check("nessun authToken nel plugin Sentry", !(sentry && sentry[1] && "authToken" in sentry[1]));

console.log(failed === 0 ? "\nTutto verde." : `\n${failed} controlli falliti.`);
process.exit(failed === 0 ? 0 : 1);
