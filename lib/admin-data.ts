/**
 * Phase 2 admin mock data. Lives here so the admin screens stay declarative.
 * Replaced by real Supabase queries in Phase 4 (along with the actual admin
 * RPC functions backed by the is_admin() helper).
 */

import { colors, folderTint } from "@/theme/tokens";

export type KPI = { label: string; value: string; delta: string; accent: string };

export const KPIS: KPI[] = [
  { label: "Attivi al giorno", value: "12,8K", delta: "+8,4%",  accent: colors.navy },
  { label: "Ricordi",          value: "2,41M", delta: "+3,1%",  accent: colors.navy },
  { label: "Ritenzione",       value: "68%",   delta: "+1,2pt", accent: colors.active },
  { label: "MRR",              value: "€24,3K", delta: "+12%",  accent: colors.navy },
];

export type ActivityItem = {
  iconKind: "folder" | "warn" | "sparkle" | "check";
  color: string;
  title: string;
  body: string;
  time: string;
};

export const ACTIVITY: ActivityItem[] = [
  { iconKind: "folder", color: colors.active, title: "Mara Bianchi", body: "è passata a Pro Annuale", time: "3m" },
  { iconKind: "warn", color: colors.fading, title: "2 carte segnalate", body: "Medicine · auto-quarantena", time: "14m" },
  { iconKind: "sparkle", color: colors.reinforcement, title: "Riepilogo settimanale", body: "inviato a 10.238 utenti", time: "2h" },
  { iconKind: "check", color: colors.navy, title: "Coorte 12 maggio", body: "87% ritenzione W1", time: "1d" },
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
  { id: "8", name: "Elena Akeyama",  email: "elena.akeyama@gmail.com",   plan: "Pro",     retention: 95, lastSeen: "ora", joined: "Feb 2026", initials: "EA" },
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
  { id: "f1", severity: "high", reason: "Possibile copia da fonte esterna",     user: "Mara Bianchi",  folder: "Medicine", source: "auto", ageHours: 4, preview: "Parafrasi da Wikipedia, sovrapposizione >90%" },
  { id: "f2", severity: "high", reason: "Identificatore personale nella carta", user: "Luca Vitti",    folder: "Japanese", source: "user", ageHours: 6, preview: "Numero di telefono rilevato" },
  { id: "f3", severity: "high", reason: "Pattern di incitamento all'odio",      user: "Anonimo",       folder: "Law",      source: "auto", ageHours: 9, preview: "Insulto nel corpo della definizione" },
  { id: "f4", severity: "med",  reason: "Dosaggio medico obsoleto",             user: "Sara Marini",   folder: "Medicine", source: "user", ageHours: 14, preview: "Schema antibiotico da linee guida pre-2020" },
  { id: "f5", severity: "low",  reason: "Corpo della carta vuoto",              user: "Tommaso Greco", folder: "Spanish",  source: "auto", ageHours: 22, preview: "Fronte compilato, retro vuoto" },
];

export type ModerationRule = {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
};

export const RULES: ModerationRule[] = [
  { id: "r1", label: "Auto-quarantena PII",                  hint: "Numeri di telefono, email, codici fiscali nel testo", enabled: true },
  { id: "r2", label: "Blocca linguaggio tossico",            hint: "Insulti, incitamento all'odio, minacce",              enabled: true },
  { id: "r3", label: "Segnala sovrapposizioni esterne",      hint: "Corrispondenza >85% con Wikipedia / Wikiquote",       enabled: true },
  { id: "r4", label: "Quarantena contenuti medici obsoleti", hint: "Linee guida dosaggi / diagnosi pre-2020",             enabled: false },
  { id: "r5", label: "Deroga al limite giornaliero",         hint: "Consenti ai Pro di superare 20/giorno",               enabled: true },
];

// pct is numeric so screens can localize the label (it-IT comma) while the
// raw value still drives the RN percentage bar width.
export type FunnelStep = { label: string; value: number; pct: number };

export const FUNNEL: FunnelStep[] = [
  { label: "Registrazione",       value: 14_320, pct: 100 },
  { label: "Onboarding completato", value: 11_847, pct: 82.7 },
  { label: "Primo ricordo",       value: 9_438,  pct: 65.9 },
  { label: "Ritenzione giorno 7", value: 6_204,  pct: 43.3 },
  { label: "Ritenzione giorno 30", value: 3_892, pct: 27.2 },
];

export type RecallByFolder = { folder: string; accuracy: number; color: string };

export const RECALL: RecallByFolder[] = [
  { folder: "Japanese", accuracy: 84, color: folderTint.jp },
  { folder: "Medicine", accuracy: 78, color: folderTint.medicine },
  { folder: "Spanish",  accuracy: 72, color: folderTint.es },
  { folder: "Law",      accuracy: 65, color: folderTint.law },
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
