// App Store Connect operations used around the first iOS release (2026-08-29).
// Needs EXPO_ASC_API_KEY_PATH / EXPO_ASC_KEY_ID / EXPO_ASC_ISSUER_ID (see docs/DEPLOY.md).
//
//   node scripts/ios-credentials/asc-ops.mjs status
//   node scripts/ios-credentials/asc-ops.mjs add-tester <email> <firstName> <lastName>
//   node scripts/ios-credentials/asc-ops.mjs review-details "<phone +39...>" "<demo password>"
//   node scripts/ios-credentials/asc-ops.mjs submit-review        # sends version 1.0 to App Review
import { call } from "./asc.mjs";

const APP_ID = "6806607162";
const VERSION_ID = "b8ec3007-9f89-47cb-b077-c52c59089ba2"; // 1.0
const INTERNAL_GROUP_ID = "a5653ced-a275-49a9-8da6-bd50e0e1bc04"; // "Memika interni"

const out = (label, r) => console.log(`${label}: ${r.status}${r.status >= 400 ? " " + JSON.stringify(r.json.errors ?? r.json).slice(0, 600) : ""}`);
const [, , cmd, ...args] = process.argv;

if (cmd === "status") {
  const v = await call("GET", `/v1/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=versionString,appVersionState,releaseType&include=build`);
  console.log("version:", JSON.stringify(v.json.data?.attributes), "build:", v.json.data?.relationships?.build?.data?.id ?? "none");
  const rd = await call("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
  console.log("reviewDetail:", rd.json.data ? JSON.stringify(rd.json.data.attributes) : "none");
  const t = await call("GET", `/v1/betaGroups/${INTERNAL_GROUP_ID}/betaTesters`);
  console.log("internal testers:", (t.json.data ?? []).map((u) => `${u.attributes.email} ${u.attributes.state}`).join(", ") || "none");
  const users = await call("GET", "/v1/users?limit=50");
  console.log("ASC users:", (users.json.data ?? []).map((u) => `${u.attributes.username} [${u.attributes.roles?.join("/")}]`).join(", "));
} else if (cmd === "add-tester") {
  const [email, firstName, lastName] = args;
  out(`betaTester ${email}`, await call("POST", "/v1/betaTesters", { data: { type: "betaTesters", attributes: { email, firstName, lastName }, relationships: { betaGroups: { data: [{ type: "betaGroups", id: INTERNAL_GROUP_ID }] } } } }));
} else if (cmd === "review-details") {
  const [phone, password] = args;
  const attrs = {
    contactFirstName: "Angelo", contactLastName: "Casula", contactEmail: "acasula97@gmail.com", contactPhone: phone,
    demoAccountRequired: true, demoAccountName: "memikaapp+review@gmail.com", demoAccountPassword: password,
    notes: "Memika è un'app di ripetizione spaziata. Accedi con l'account demo, apri Oggi e tocca Inizia il ripasso: le tre fasi Scan, Reinforcement e Focus. L'eliminazione dell'account è in Impostazioni. Nessun acquisto in-app in questa versione.\n\nMemika is a spaced-repetition app. Sign in with the demo account, open Today and tap Start today's review: Scan, Reinforcement and Focus. Account deletion is in Settings. No in-app purchases in this version.",
  };
  const existing = await call("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
  if (existing.json.data) out("reviewDetail PATCH", await call("PATCH", `/v1/appStoreReviewDetails/${existing.json.data.id}`, { data: { type: "appStoreReviewDetails", id: existing.json.data.id, attributes: attrs } }));
  else out("reviewDetail POST", await call("POST", "/v1/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes: attrs, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } } } } }));
} else if (cmd === "submit-review") {
  const sub = await call("POST", "/v1/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } } });
  out("reviewSubmission POST", sub);
  if (sub.status !== 201) process.exit(1);
  const item = await call("POST", "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub.json.data.id } }, appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } } } } });
  out("reviewSubmissionItem POST", item);
  const go = await call("PATCH", `/v1/reviewSubmissions/${sub.json.data.id}`, { data: { type: "reviewSubmissions", id: sub.json.data.id, attributes: { submitted: true } } });
  out("reviewSubmission submitted", go);
} else {
  console.log("commands: status | add-tester <email> <first> <last> | review-details <phone> <password> | submit-review");
}
