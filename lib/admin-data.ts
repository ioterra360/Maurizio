/**
 * Phase 2 admin mock data. Lives here so the admin screens stay declarative.
 * Replaced by real Supabase queries in Phase 4 (along with the actual admin
 * RPC functions backed by the is_admin() helper).
 */

import { colors } from "@/theme/tokens";

export type KPI = { label: string; value: string; delta: string; accent: string };

export const KPIS: KPI[] = [
  { label: "Daily active",  value: "12.8K", delta: "+8.4%",  accent: colors.navy },
  { label: "Memories",      value: "2.41M", delta: "+3.1%",  accent: colors.active },
  { label: "Retention",     value: "68%",   delta: "+1.2pt", accent: colors.reinforcement },
  { label: "MRR",           value: "$24.3K", delta: "+12%",  accent: colors.scan },
];

export type ActivityItem = {
  iconKind: "folder" | "warn" | "sparkle" | "check";
  color: string;
  title: string;
  body: string;
  time: string;
};

export const ACTIVITY: ActivityItem[] = [
  { iconKind: "folder", color: colors.active, title: "Mara Bianchi", body: "upgraded to Pro Annual", time: "3m" },
  { iconKind: "warn", color: colors.fading, title: "2 cards flagged", body: "Medicine · auto-quarantine", time: "14m" },
  { iconKind: "sparkle", color: colors.reinforcement, title: "Weekly digest", body: "sent to 10,238 users", time: "2h" },
  { iconKind: "check", color: colors.navy, title: "Cohort May 12", body: "87% W1 retention", time: "1d" },
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
  { id: "1", name: "Mara Bianchi",   email: "mara.bianchi@gmail.com",    plan: "Pro",     retention: 88, lastSeen: "5m",  joined: "Jan 2026", initials: "MB" },
  { id: "2", name: "Luca Vitti",     email: "lvitti@hey.com",            plan: "Pro",     retention: 92, lastSeen: "12m", joined: "Feb 2026", initials: "LV" },
  { id: "3", name: "Ada Rinaldi",    email: "ada.r@studenti.it",         plan: "Free",    retention: 41, lastSeen: "1h",  joined: "Apr 2026", initials: "AR" },
  { id: "4", name: "Giulia Romano",  email: "giulia.romano@me.com",      plan: "At risk", retention: 22, lastSeen: "9d",  joined: "Nov 2025", initials: "GR" },
  { id: "5", name: "Tommaso Greco",  email: "tom.greco@duck.com",        plan: "Pro",     retention: 76, lastSeen: "32m", joined: "Mar 2026", initials: "TG" },
  { id: "6", name: "Sara Marini",    email: "sara@marini.studio",        plan: "Pro",     retention: 81, lastSeen: "2h",  joined: "Jan 2026", initials: "SM" },
  { id: "7", name: "Davide Conti",   email: "dconti@uni.it",             plan: "Free",    retention: 52, lastSeen: "3d",  joined: "Mar 2026", initials: "DC" },
  { id: "8", name: "Elena Akeyama",  email: "elena.akeyama@gmail.com",   plan: "Pro",     retention: 95, lastSeen: "now", joined: "Feb 2026", initials: "EA" },
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
  { id: "f1", severity: "high", reason: "Possible copy from external source",   user: "Mara Bianchi",  folder: "Medicine", source: "auto", ageHours: 4, preview: "Wikipedia paraphrase, 90%+ overlap" },
  { id: "f2", severity: "high", reason: "Personal identifier in card",          user: "Luca Vitti",    folder: "Japanese", source: "user", ageHours: 6, preview: "Phone number detected" },
  { id: "f3", severity: "high", reason: "Hate-speech pattern",                  user: "Anonymous",     folder: "Law",      source: "auto", ageHours: 9, preview: "Slur in definition body" },
  { id: "f4", severity: "med",  reason: "Outdated medical dosage",              user: "Sara Marini",   folder: "Medicine", source: "user", ageHours: 14, preview: "Antibiotic schedule pre-2020 guideline" },
  { id: "f5", severity: "low",  reason: "Empty card body",                      user: "Tommaso Greco", folder: "Spanish",  source: "auto", ageHours: 22, preview: "Front filled, back blank" },
];

export type ModerationRule = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
};

export const RULES: ModerationRule[] = [
  { id: "r1", label: "Auto-quarantine PII",             hint: "Phone numbers, emails, SSNs in card text", enabled: true },
  { id: "r2", label: "Block toxic language",            hint: "Slurs, hate speech, threats",              enabled: true },
  { id: "r3", label: "Flag external-source overlap",    hint: ">85% match with Wikipedia / Wikiquote",    enabled: true },
  { id: "r4", label: "Quarantine outdated medical",     hint: "Pre-2020 dosage / dx guidelines",          enabled: false },
  { id: "r5", label: "Daily input cap override",        hint: "Allow Pro to exceed 20/day",               enabled: true },
];

export type FunnelStep = { label: string; value: number; pct: string };

export const FUNNEL: FunnelStep[] = [
  { label: "Sign-up",        value: 14_320, pct: "100%" },
  { label: "Onboarding done", value: 11_847, pct: "82.7%" },
  { label: "First memory",   value: 9_438,  pct: "65.9%" },
  { label: "Day 7 retained", value: 6_204,  pct: "43.3%" },
  { label: "Day 30 retained", value: 3_892, pct: "27.2%" },
];

export type RecallByFolder = { folder: string; accuracy: number; color: string };

export const RECALL: RecallByFolder[] = [
  { folder: "Japanese", accuracy: 84, color: "#FCE9E9" },
  { folder: "Medicine", accuracy: 78, color: "#E8F5EE" },
  { folder: "Spanish",  accuracy: 72, color: "#FDF1E0" },
  { folder: "Law",      accuracy: 65, color: "#EEEAFB" },
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
  { id: "u1", name: "Maurizio Cocco",  email: "maurizio.cocco@memora.app",  role: "Owner",    initials: "MC" },
  { id: "u2", name: "Angelo Casula",   email: "angelo.casula@gmail.com",    role: "Engineer", initials: "AC" },
  { id: "u3", name: "Elena Akeyama",   email: "elena.akeyama@memora.app",   role: "Admin",    initials: "EA" },
  { id: "u4", name: "Marco Rossi",     email: "marco.rossi@memora.app",     role: "Editor",   initials: "MR" },
  { id: "u5", name: "Sofia Conti",     email: "sofia@memora.app",           role: "Support",  initials: "SC" },
];
