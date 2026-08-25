/**
 * Pure helpers behind the "Informazioni" section of Settings: the real
 * version/build string and the "with Memika since <month year>" line.
 *
 * Kept free of expo-constants so it is unit-testable; the screen passes
 * the raw values in (see `readAppVersion` for the mapping).
 */

export type AppVersionInput = {
  /** `Constants.expoConfig?.version` — the marketing version from app.json. */
  version?: string | null;
  /**
   * Build number of the NATIVE binary: `Constants.platform?.ios?.buildNumber`
   * (CFBundleVersion) or `Constants.platform?.android?.versionCode`. These
   * are what EAS remote versioning actually stamps into the binary; both
   * are null in Expo Go.
   */
  nativeBuild?: string | number | null;
  /**
   * Fallback from the bundled config (`expoConfig.ios.buildNumber` /
   * `expoConfig.android.versionCode`) — usually empty because app.json does
   * not pin a build number (EAS owns it remotely), but harmless to consult.
   */
  configBuild?: string | number | null;
};

export type AppVersion = {
  version: string;
  build: string | null;
};

function normalizeBuild(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/** Picks the native build first, then the config one; version falls back to "—". */
export function resolveAppVersion(input: AppVersionInput): AppVersion {
  const version = (input.version ?? "").trim() || "—";
  const build = normalizeBuild(input.nativeBuild) ?? normalizeBuild(input.configBuild);
  return { version, build };
}

/** "0.1.0 (12)" when a build is known, "0.1.0" otherwise. */
export function formatAppVersion(input: AppVersionInput): string {
  const { version, build } = resolveAppVersion(input);
  return build ? `${version} (${build})` : version;
}

const ITALIAN_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

/**
 * "da agosto 2026" from a profiles.created_at ISO timestamp. Returns null
 * for a missing or unparsable value so the caller can hide the line
 * instead of inventing a date. Uses the device's local time zone — an
 * account created at 23:30 UTC on the last day of a month shows the
 * month the user actually experienced.
 */
export function memberSinceLabel(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const month = ITALIAN_MONTHS[date.getMonth()];
  return `da ${month} ${date.getFullYear()}`;
}
