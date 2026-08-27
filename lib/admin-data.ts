/**
 * Phase 2 admin mock data. Lives here so the admin screens stay declarative.
 * Replaced by real Supabase queries in Phase 4 (along with the actual admin
 * RPC functions backed by the is_admin() helper).
 *
 * User-visible text fields are getters that resolve `t()` at access time, so
 * the Settings language switch applies at once (never cache translations in
 * module-level constants).
 */

import { t } from "@/lib/i18n";
import { colors, folderTint } from "@/theme/tokens";

export type KPI = { label: string; value: string; delta: string; accent: string };

export const KPIS: KPI[] = [
  {
    get label() { return t("adminData.kpiDailyActiveLabel"); },
    get value() { return t("adminData.kpiDailyActiveValue"); },
    get delta() { return t("adminData.kpiDailyActiveDelta"); },
    accent: colors.navy,
  },
  {
    get label() { return t("adminData.kpiMemoriesLabel"); },
    get value() { return t("adminData.kpiMemoriesValue"); },
    get delta() { return t("adminData.kpiMemoriesDelta"); },
    accent: colors.navy,
  },
  {
    get label() { return t("adminData.kpiRetentionLabel"); },
    get value() { return t("adminData.kpiRetentionValue"); },
    get delta() { return t("adminData.kpiRetentionDelta"); },
    accent: colors.active,
  },
  {
    get label() { return t("adminData.kpiMrrLabel"); },
    get value() { return t("adminData.kpiMrrValue"); },
    get delta() { return t("adminData.kpiMrrDelta"); },
    accent: colors.navy,
  },
];

export type ActivityItem = {
  iconKind: "folder" | "warn" | "sparkle" | "check";
  color: string;
  title: string;
  body: string;
  time: string;
};

export const ACTIVITY: ActivityItem[] = [
  {
    iconKind: "folder",
    color: colors.active,
    title: "Mara Bianchi",
    get body() { return t("adminData.activityUpgradeBody"); },
    get time() { return t("adminData.activityUpgradeTime"); },
  },
  {
    iconKind: "warn",
    color: colors.fading,
    get title() { return t("adminData.activityFlaggedTitle"); },
    get body() { return t("adminData.activityFlaggedBody"); },
    get time() { return t("adminData.activityFlaggedTime"); },
  },
  {
    iconKind: "sparkle",
    color: colors.reinforcement,
    get title() { return t("adminData.activityDigestTitle"); },
    get body() { return t("adminData.activityDigestBody"); },
    get time() { return t("adminData.activityDigestTime"); },
  },
  {
    iconKind: "check",
    color: colors.navy,
    get title() { return t("adminData.activityCohortTitle"); },
    get body() { return t("adminData.activityCohortBody"); },
    get time() { return t("adminData.activityCohortTime"); },
  },
];

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  plan: "Pro" | "Free" | "At risk";
  retention: number;
  lastSeen: string;
  joined: string;
  initials: string;
};

export const USERS: AdminUser[] = [
  { id: "1", name: "Mara Bianchi",   email: "mara.bianchi@gmail.com",    plan: "Pro",     retention: 88, get lastSeen() { return t("adminData.userLastSeen1"); }, joined: "Jan 2026", initials: "MB" },
  { id: "2", name: "Luca Vitti",     email: "lvitti@hey.com",            plan: "Pro",     retention: 92, get lastSeen() { return t("adminData.userLastSeen2"); }, joined: "Feb 2026", initials: "LV" },
  { id: "3", name: "Ada Rinaldi",    email: "ada.r@studenti.it",         plan: "Free",    retention: 41, get lastSeen() { return t("adminData.userLastSeen3"); }, joined: "Apr 2026", initials: "AR" },
  { id: "4", name: "Giulia Romano",  email: "giulia.romano@me.com",      plan: "At risk", retention: 22, get lastSeen() { return t("adminData.userLastSeen4"); }, joined: "Nov 2025", initials: "GR" },
  { id: "5", name: "Tommaso Greco",  email: "tom.greco@duck.com",        plan: "Pro",     retention: 76, get lastSeen() { return t("adminData.userLastSeen5"); }, joined: "Mar 2026", initials: "TG" },
  { id: "6", name: "Sara Marini",    email: "sara@marini.studio",        plan: "Pro",     retention: 81, get lastSeen() { return t("adminData.userLastSeen6"); }, joined: "Jan 2026", initials: "SM" },
  { id: "7", name: "Davide Conti",   email: "dconti@uni.it",             plan: "Free",    retention: 52, get lastSeen() { return t("adminData.userLastSeen7"); }, joined: "Mar 2026", initials: "DC" },
  { id: "8", name: "Elena Akeyama",  email: "elena.akeyama@gmail.com",   plan: "Pro",     retention: 95, get lastSeen() { return t("adminData.userLastSeen8"); }, joined: "Feb 2026", initials: "EA" },
];

export type FlagSeverity = "low" | "med" | "high";

export type FlagItem = {
  id: string;
  severity: FlagSeverity;
  reason: string;
  user: string;
  folder: string;
  source: "auto" | "user";
  ageHours: number;
  preview: string;
};

export const FLAGS: FlagItem[] = [
  {
    id: "f1",
    severity: "high",
    get reason() { return t("adminData.flagReasonExternalCopy"); },
    user: "Mara Bianchi",
    get folder() { return t("adminData.folderMedicine"); },
    source: "auto",
    ageHours: 4,
    get preview() { return t("adminData.flagPreviewExternalCopy"); },
  },
  {
    id: "f2",
    severity: "high",
    get reason() { return t("adminData.flagReasonPersonalIdentifier"); },
    user: "Luca Vitti",
    get folder() { return t("adminData.folderJapanese"); },
    source: "user",
    ageHours: 6,
    get preview() { return t("adminData.flagPreviewPersonalIdentifier"); },
  },
  {
    id: "f3",
    severity: "high",
    get reason() { return t("adminData.flagReasonHateSpeech"); },
    get user() { return t("adminData.flagUserAnonymous"); },
    get folder() { return t("adminData.folderLaw"); },
    source: "auto",
    ageHours: 9,
    get preview() { return t("adminData.flagPreviewHateSpeech"); },
  },
  {
    id: "f4",
    severity: "med",
    get reason() { return t("adminData.flagReasonOutdatedDosage"); },
    user: "Sara Marini",
    get folder() { return t("adminData.folderMedicine"); },
    source: "user",
    ageHours: 14,
    get preview() { return t("adminData.flagPreviewOutdatedDosage"); },
  },
  {
    id: "f5",
    severity: "low",
    get reason() { return t("adminData.flagReasonEmptyBody"); },
    user: "Tommaso Greco",
    get folder() { return t("adminData.folderSpanish"); },
    source: "auto",
    ageHours: 22,
    get preview() { return t("adminData.flagPreviewEmptyBody"); },
  },
];

export type ModerationRule = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
};

export const RULES: ModerationRule[] = [
  {
    id: "r1",
    get label() { return t("adminData.rulePiiLabel"); },
    get hint() { return t("adminData.rulePiiHint"); },
    enabled: true,
  },
  {
    id: "r2",
    get label() { return t("adminData.ruleToxicLabel"); },
    get hint() { return t("adminData.ruleToxicHint"); },
    enabled: true,
  },
  {
    id: "r3",
    get label() { return t("adminData.ruleExternalOverlapLabel"); },
    get hint() { return t("adminData.ruleExternalOverlapHint"); },
    enabled: true,
  },
  {
    id: "r4",
    get label() { return t("adminData.ruleOutdatedMedicalLabel"); },
    get hint() { return t("adminData.ruleOutdatedMedicalHint"); },
    enabled: false,
  },
  {
    id: "r5",
    get label() { return t("adminData.ruleDailyLimitLabel"); },
    get hint() { return t("adminData.ruleDailyLimitHint"); },
    enabled: true,
  },
];

// pct is numeric so screens can localize the label (it-IT comma) while the
// raw value still drives the RN percentage bar width.
export type FunnelStep = { label: string; value: number; pct: number };

export const FUNNEL: FunnelStep[] = [
  { get label() { return t("adminData.funnelSignup"); },         value: 14_320, pct: 100 },
  { get label() { return t("adminData.funnelOnboardingDone"); }, value: 11_847, pct: 82.7 },
  { get label() { return t("adminData.funnelFirstMemory"); },    value: 9_438,  pct: 65.9 },
  { get label() { return t("adminData.funnelDay7Retention"); },  value: 6_204,  pct: 43.3 },
  { get label() { return t("adminData.funnelDay30Retention"); }, value: 3_892,  pct: 27.2 },
];

export type RecallByFolder = { folder: string; accuracy: number; color: string };

export const RECALL: RecallByFolder[] = [
  { get folder() { return t("adminData.folderJapanese"); }, accuracy: 84, color: folderTint.jp },
  { get folder() { return t("adminData.folderMedicine"); }, accuracy: 78, color: folderTint.medicine },
  { get folder() { return t("adminData.folderSpanish"); },  accuracy: 72, color: folderTint.es },
  { get folder() { return t("adminData.folderLaw"); },      accuracy: 65, color: folderTint.law },
];

export type SystemService = {
  name: string;
  status: "ok" | "degraded" | "down";
  detail: string;
};

export const SERVICES: SystemService[] = [
  { name: "API gateway",   status: "ok",       detail: "p50 84ms · p95 240ms" },
  { name: "Sync engine",   status: "ok",       detail: "queue 0 / lag 1s" },
  { name: "AI generator",  status: "degraded", detail: "latency 1.8s · 2 retries" },
  { name: "Push delivery", status: "ok",       detail: "98.4% delivered last hour" },
  { name: "Postgres",      status: "ok",       detail: "12% CPU · 41% mem" },
  { name: "Storage",       status: "ok",       detail: "1.42 TB used" },
  { name: "Auth",          status: "ok",       detail: "0 failed signups (1h)" },
  { name: "Stripe",        status: "ok",       detail: "2 webhooks (1h)" },
];

export type ContentTemplate = {
  id: string;
  title: string;
  folder: string;
  cards: number;
  state: "Published" | "Draft";
};

export const TEMPLATES: ContentTemplate[] = [
  { id: "t1", title: "JLPT N5 essentials",          folder: "Japanese", cards: 220, state: "Published" },
  { id: "t2", title: "JLPT N4 kanji",                folder: "Japanese", cards: 480, state: "Published" },
  { id: "t3", title: "USMLE Step 1 — core",         folder: "Medicine", cards: 612, state: "Published" },
  { id: "t4", title: "Spanish A2 → B2 verbs",        folder: "Spanish",  cards: 380, state: "Published" },
  { id: "t5", title: "Common-law doctrines",         folder: "Law",      cards: 140, state: "Draft" },
  { id: "t6", title: "Pharmacology — beta-blockers", folder: "Medicine", cards: 56,  state: "Draft" },
];

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Engineer" | "Editor" | "Support";
  initials: string;
};

export const TEAM: TeamMember[] = [
  { id: "u1", name: "Maurizio Cocco",  email: "maurizio.cocco@memika.app",  role: "Owner",    initials: "MC" },
  { id: "u2", name: "Angelo Casula",   email: "angelo.casula@gmail.com",    role: "Engineer", initials: "AC" },
  { id: "u3", name: "Elena Akeyama",   email: "elena.akeyama@memika.app",   role: "Admin",    initials: "EA" },
  { id: "u4", name: "Marco Rossi",     email: "marco.rossi@memika.app",     role: "Editor",   initials: "MR" },
  { id: "u5", name: "Sofia Conti",     email: "sofia@memika.app",           role: "Support",  initials: "SC" },
];
