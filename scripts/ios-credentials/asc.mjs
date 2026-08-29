// Minimal App Store Connect API client (JWT ES256 with the team API key).
// Usage: node scripts/ios-credentials/asc.mjs GET /v1/certificates
//        node scripts/ios-credentials/asc.mjs POST /v1/profiles '{"data":{...}}'
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

// Same env vars eas-cli uses for App Store Connect API key auth.
const KEY_PATH = process.env.EXPO_ASC_API_KEY_PATH;
const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER = process.env.EXPO_ASC_ISSUER_ID;
if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error("Set EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID and EXPO_ASC_ISSUER_ID (see docs/DEPLOY.md).");
  process.exit(2);
}

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const key = createPrivateKey(readFileSync(KEY_PATH, "utf8"));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function call(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

if (process.argv[1] && process.argv[1].endsWith("asc.mjs") && process.argv[2]) {
  const [, , method, path, body] = process.argv;
  const r = await call(method, path, body ? JSON.parse(body) : undefined);
  console.log(r.status);
  console.log(JSON.stringify(r.json, null, 2).slice(0, 6000));
}
