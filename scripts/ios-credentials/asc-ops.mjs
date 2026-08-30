// App Store Connect operations used around the first iOS release (2026-08-29).
// Needs EXPO_ASC_API_KEY_PATH / EXPO_ASC_KEY_ID / EXPO_ASC_ISSUER_ID (see docs/DEPLOY.md).
//
//   node scripts/ios-credentials/asc-ops.mjs status
//   node scripts/ios-credentials/asc-ops.mjs add-tester <email> <firstName> <lastName>   # internal TestFlight group (email must be an ASC user)
//   node scripts/ios-credentials/asc-ops.mjs invite-user <email> <firstName> <lastName> [ADMIN]  # invite an App Store Connect user
//   node scripts/ios-credentials/asc-ops.mjs review-details "<phone +39...>" "<demo password>"
//   node scripts/ios-credentials/asc-ops.mjs set-free             # price Free (base ITA) + available in all territories
//   node scripts/ios-credentials/asc-ops.mjs submit-review        # sends version 1.0 to App Review
import { call } from "./asc.mjs";

const APP_ID = "6806607162";
const VERSION_ID = "b8ec3007-9f89-47cb-b077-c52c59089ba2"; // 1.0
const INTERNAL_GROUP_ID = "a5653ced-a275-49a9-8da6-bd50e0e1bc04"; // "Memika interni"

const out = (label, r) => console.log(`${label}: ${r.status}${r.status >= 400 ? " " + JSON.stringify(r.json.errors ?? r.json).slice(0, 600) : ""}`);
const [, , cmd, ...args] = process.argv;

if (cmd === "status") {
  const v = await call("GET", `/v1/appStoreVersions/${VERSION_ID}?fields[appStoreVersions]=versionString,appVersionState,releaseType,build&include=build&fields[builds]=version,processingState`);
  console.log("version:", JSON.stringify(v.json.data?.attributes), "build:", v.json.included?.[0] ? `${v.json.included[0].attributes.version} ${v.json.included[0].attributes.processingState} (${v.json.included[0].id})` : "none");
  const rd = await call("GET", `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`);
  console.log("reviewDetail:", rd.json.data ? JSON.stringify(rd.json.data.attributes) : "none");
  const t = await call("GET", `/v1/betaGroups/${INTERNAL_GROUP_ID}/betaTesters`);
  console.log("internal testers:", (t.json.data ?? []).map((u) => `${u.attributes.email} ${u.attributes.state}`).join(", ") || "none");
  const prices = await call("GET", `/v1/appPriceSchedules/${APP_ID}/manualPrices?include=appPricePoint,territory&fields[appPricePoints]=customerPrice&limit=5`);
  const pts = Object.fromEntries((prices.json.included ?? []).filter((i) => i.type === "appPricePoints").map((i) => [i.id, i.attributes.customerPrice]));
  console.log("price:", prices.status === 200 ? (prices.json.data ?? []).map((pr) => `${pr.relationships.territory.data.id} ${pts[pr.relationships.appPricePoint.data.id]}`).join(", ") || "schedule without manual prices" : "NOT SET");
  const avail = await call("GET", `/v1/apps/${APP_ID}/appAvailabilityV2?fields[appAvailabilities]=availableInNewTerritories`);
  let availLine = "NOT SET";
  if (avail.status === 200 && avail.json.data) {
    let n = 0, total = 0, next = `/v2/appAvailabilities/${avail.json.data.id}/territoryAvailabilities?fields[territoryAvailabilities]=available&limit=50`;
    while (next) {
      const page = await call("GET", next);
      for (const t of page.json.data ?? []) { total++; if (t.attributes.available) n++; }
      next = page.json.links?.next ? page.json.links.next.replace("https://api.appstoreconnect.apple.com", "") : null;
    }
    availLine = `available in ${n}/${total} territories, new territories=${avail.json.data.attributes.availableInNewTerritories}`;
  }
  console.log("availability:", availLine);
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
} else if (cmd === "invite-user") {
  const [email, firstName, lastName, role = "ADMIN"] = args;
  out(`userInvitation ${email} [${role}]`, await call("POST", "/v1/userInvitations", { data: { type: "userInvitations", attributes: { email, firstName, lastName, roles: [role], allAppsVisible: true, ...(role === "ADMIN" ? {} : { provisioningAllowed: true }) } } }));
} else if (cmd === "set-free") {
  // Price schedule: base territory ITA, one manual price = the 0.0 price point, no start date (= now).
  const points = await call("GET", `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=ITA&fields[appPricePoints]=customerPrice&limit=5`);
  const free = (points.json.data ?? []).find((pp) => Number(pp.attributes.customerPrice) === 0);
  if (!free) { console.log("no free price point found", points.status, JSON.stringify(points.json).slice(0, 300)); process.exit(1); }
  out("appPriceSchedule POST", await call("POST", "/v1/appPriceSchedules", {
    data: { type: "appPriceSchedules", relationships: {
      app: { data: { type: "apps", id: APP_ID } },
      baseTerritory: { data: { type: "territories", id: "ITA" } },
      manualPrices: { data: [{ type: "appPrices", id: "${price-free}" }] },
    } },
    included: [{ type: "appPrices", id: "${price-free}", attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: "appPricePoints", id: free.id } } } }],
  }));
  // Availability: every territory Apple lists, plus future territories.
  const terr = await call("GET", "/v1/territories?limit=200");
  const ids = (terr.json.data ?? []).map((t) => t.id);
  console.log(`territories: ${ids.length}`);
  out("appAvailabilities POST", await call("POST", "/v2/appAvailabilities", {
    data: { type: "appAvailabilities", attributes: { availableInNewTerritories: true }, relationships: {
      app: { data: { type: "apps", id: APP_ID } },
      territoryAvailabilities: { data: ids.map((id) => ({ type: "territoryAvailabilities", id: "${t-" + id + "}" })) },
    } },
    included: ids.map((id) => ({ type: "territoryAvailabilities", id: "${t-" + id + "}", attributes: { available: true }, relationships: { territory: { data: { type: "territories", id } } } })),
  }));
} else if (cmd === "submit-review") {
  const sub = await call("POST", "/v1/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } } });
  out("reviewSubmission POST", sub);
  if (sub.status !== 201) process.exit(1);
  const item = await call("POST", "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub.json.data.id } }, appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } } } } });
  out("reviewSubmissionItem POST", item);
  const go = await call("PATCH", `/v1/reviewSubmissions/${sub.json.data.id}`, { data: { type: "reviewSubmissions", id: sub.json.data.id, attributes: { submitted: true } } });
  out("reviewSubmission submitted", go);
} else {
  console.log("commands: status | add-tester <email> <first> <last> | invite-user <email> <first> <last> [ROLE] | review-details <phone> <password> | set-free | submit-review");
}
