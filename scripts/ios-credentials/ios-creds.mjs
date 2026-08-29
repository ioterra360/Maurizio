// Creates the iOS distribution certificate + App Store provisioning profile
// through the App Store Connect API and writes credentials.json for EAS
// (credentialsSource: local). Secrets stay in .credentials/ (gitignored).
// Prereq: .credentials/dist.key + dist.csr (openssl, see docs/DEPLOY.md) and
// the EXPO_ASC_* env vars. Used for the first build on 2026-08-29; re-run at
// certificate renewal (2027-08-29) or if the profile is invalidated.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { call } from "./asc.mjs";

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CRED = `${APP}/.credentials`;
const BUNDLE_ID_RESOURCE = process.env.ASC_BUNDLE_ID_RESOURCE ?? "DKCAUU78JN"; // studio.tailor.memika (GET /v1/bundleIds?filter[identifier]=...)

const csrPem = readFileSync(`${CRED}/dist.csr`, "utf8");
const csrContent = csrPem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");

// 1. distribution certificate
let cert = await call("POST", "/v1/certificates", {
  data: { type: "certificates", attributes: { certificateType: "IOS_DISTRIBUTION", csrContent } },
});
if (cert.status !== 201) {
  console.error("certificate creation failed", cert.status, JSON.stringify(cert.json).slice(0, 800));
  process.exit(1);
}
const certId = cert.json.data.id;
const certAttrs = cert.json.data.attributes;
writeFileSync(`${CRED}/dist.cer`, Buffer.from(certAttrs.certificateContent, "base64"));
execSync(`openssl x509 -inform der -in "${CRED}/dist.cer" -out "${CRED}/dist.crt"`);
console.log("certificate", certId, certAttrs.name, certAttrs.certificateType, "expires", certAttrs.expirationDate, "serial", certAttrs.serialNumber);

// 2. .p12 for EAS
const password = randomBytes(16).toString("hex");
execSync(`openssl pkcs12 -export -inkey "${CRED}/dist.key" -in "${CRED}/dist.crt" -out "${CRED}/dist.p12" -passout pass:${password} -legacy`, { stdio: "inherit" });
console.log("p12 written");

// 3. App Store provisioning profile
const prof = await call("POST", "/v1/profiles", {
  data: {
    type: "profiles",
    attributes: { name: "Memika App Store", profileType: "IOS_APP_STORE" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: BUNDLE_ID_RESOURCE } },
      certificates: { data: [{ type: "certificates", id: certId }] },
    },
  },
});
if (prof.status !== 201) {
  console.error("profile creation failed", prof.status, JSON.stringify(prof.json).slice(0, 800));
  process.exit(1);
}
const p = prof.json.data;
writeFileSync(`${CRED}/Memika_App_Store.mobileprovision`, Buffer.from(p.attributes.profileContent, "base64"));
console.log("profile", p.id, p.attributes.name, p.attributes.profileState, "uuid", p.attributes.uuid, "expires", p.attributes.expirationDate);

// 4. credentials.json for eas build (paths relative to the project root)
writeFileSync(`${APP}/credentials.json`, JSON.stringify({
  ios: {
    provisioningProfilePath: ".credentials/Memika_App_Store.mobileprovision",
    distributionCertificate: { path: ".credentials/dist.p12", password },
  },
}, null, 2) + "\n");
console.log("credentials.json written");
