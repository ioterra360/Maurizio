/**
 * DEMO-MODE mock content for the four folder templates (demo accounts still
 * show four folders so the offline UI stays reviewable). Real users start
 * with ONE folder picked at onboarding — see lib/folder-templates.ts.
 * Mirrors the design contract in _design_drop/memika/project/folder-screen.jsx.
 */

import {
  CUSTOM_FOLDER_KIND,
  CUSTOM_ITEM_TYPES,
  FOLDER_TEMPLATES,
  type FolderKind,
  type ItemTypeOption,
  type MemoryState,
  type TemplateKind,
} from "./constants";

export type FolderItem = {
  front: string;
  reading?: string;
  back: string;
  state: MemoryState;
  reviewed: string;
  layer?: "scan" | "reinforcement" | "focus";
};

export type FolderSeed = {
  kind: TemplateKind;
  name: string;
  priority: number;
  count: number;
  active: number;
  fading: number;
  archived: number;
  addedThisWeek: number;
  items: FolderItem[];
};

const FOLDERS: Record<TemplateKind, FolderSeed> = {
  jp: {
    kind: "jp",
    name: "Giapponese",
    priority: 1,
    count: 247,
    active: 78,
    fading: 16,
    archived: 6,
    addedThisWeek: 6,
    items: [
      { front: "中心", reading: "chūshin", back: "Center · core · the middle", state: "active", reviewed: "2 days ago", layer: "focus" },
      { front: "時間", reading: "jikan", back: "Time · hour", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "友達", reading: "tomodachi", back: "Friend", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "完璧", reading: "kanpeki", back: "Perfect · flawless · complete", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "希望", reading: "kibō", back: "Hope · wish · aspiration", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "医者", reading: "isha", back: "Doctor · physician", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "難しい", reading: "muzukashii", back: "Difficult · hard · challenging", state: "fading", reviewed: "12 days ago", layer: "scan" },
      { front: "散歩", reading: "sanpo", back: "A walk · stroll", state: "fading", reviewed: "18 days ago", layer: "scan" },
      { front: "厳しい", reading: "kibishii", back: "Strict · severe", state: "archived", reviewed: "2 months ago" },
    ],
  },
  medicine: {
    kind: "medicine",
    name: "Medicina",
    priority: 2,
    count: 312,
    active: 71,
    fading: 21,
    archived: 8,
    addedThisWeek: 4,
    items: [
      { front: "Tachycardia", back: "Resting heart rate above 100 bpm", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Bradycardia", back: "A slower-than-normal heart rate", state: "active", reviewed: "2 days ago", layer: "reinforcement" },
      { front: "Mitosis", back: "Cell division producing two identical daughter cells", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "Synapse", back: "Junction between two neurons", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "Edema", back: "Abnormal fluid accumulation in tissues", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "Auscultation", back: "Listening to internal body sounds with a stethoscope", state: "fading", reviewed: "11 days ago", layer: "scan" },
      { front: "Apoptosis", back: "Programmed cell death", state: "fading", reviewed: "14 days ago", layer: "scan" },
      { front: "Atrial fibrillation", back: "Irregular, often rapid heart rhythm", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Pruritus", back: "Itching sensation", state: "archived", reviewed: "3 months ago" },
    ],
  },
  es: {
    kind: "es",
    name: "Spagnolo",
    priority: 3,
    count: 132,
    active: 65,
    fading: 25,
    archived: 10,
    addedThisWeek: 2,
    items: [
      { front: "ámbito", back: "Scope · sphere · realm", state: "active", reviewed: "2 days ago", layer: "reinforcement" },
      { front: "biblioteca", back: "Library", state: "active", reviewed: "4 days ago", layer: "scan" },
      { front: "aprender", back: "To learn", state: "active", reviewed: "3 days ago", layer: "scan" },
      { front: "entender", back: "To understand", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "recordar", back: "To remember · to remind", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "amanecer", back: "Dawn · sunrise · daybreak", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "desarrollar", back: "To develop · to grow", state: "fading", reviewed: "13 days ago", layer: "scan" },
      { front: "olvidar", back: "To forget · to leave behind", state: "fading", reviewed: "16 days ago", layer: "scan" },
      { front: "escabullirse", back: "To slip away · to sneak off", state: "archived", reviewed: "2 months ago" },
    ],
  },
  law: {
    kind: "law",
    name: "Diritto",
    priority: 4,
    count: 88,
    active: 52,
    fading: 33,
    archived: 15,
    addedThisWeek: 3,
    items: [
      { front: "Estoppel", back: "Preclusion of contradiction in legal proceedings", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Habeas corpus", back: "A right to challenge unlawful detention", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "Tort", back: "A civil wrong causing harm or loss", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "Prima facie", back: "At first sight · on first appearance", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "Mens rea", back: "Guilty mind · the intent behind the act", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "Res judicata", back: "A matter already judged · cannot be retried", state: "fading", reviewed: "12 days ago", layer: "scan" },
      { front: "Stare decisis", back: "Stand by what is decided · precedent rule", state: "fading", reviewed: "15 days ago", layer: "scan" },
      { front: "Caveat emptor", back: "Let the buyer beware", state: "fading", reviewed: "20 days ago", layer: "scan" },
      { front: "Voir dire", back: "Preliminary jury examination", state: "archived", reviewed: "3 months ago" },
    ],
  },
};

/** Demo seed for a kind — undefined for `custom` (no mock content). */
export function getFolderSeed(kind: FolderKind): FolderSeed | undefined {
  return (FOLDERS as Partial<Record<FolderKind, FolderSeed>>)[kind];
}

export function getAllFolderSeeds(): FolderSeed[] {
  return [FOLDERS.jp, FOLDERS.medicine, FOLDERS.es, FOLDERS.law];
}

export type { ItemTypeOption };

/**
 * Item-type chips per folder kind, used by the Add screen. Templates carry
 * their own (lib/constants.ts); a custom folder gets the generic set.
 */
export const ITEM_TYPES_BY_KIND: Record<FolderKind, readonly ItemTypeOption[]> = {
  ...(Object.fromEntries(FOLDER_TEMPLATES.map((t) => [t.kind, t.itemTypes])) as Record<
    TemplateKind,
    readonly ItemTypeOption[]
  >),
  [CUSTOM_FOLDER_KIND]: CUSTOM_ITEM_TYPES,
};

/** Preview cards used in the Add-to-Memory preview tile. */
export const ADD_PREVIEW_BY_KIND: Record<FolderKind, { front: string; back: string }> = {
  jp: { front: "中心", back: "Centro · nucleo · il mezzo" },
  medicine: { front: "Tachicardia", back: "Frequenza cardiaca a riposo sopra i 100 bpm" },
  es: { front: "ámbito", back: "Ambito · sfera · campo d'azione" },
  law: { front: "Estoppel", back: "Preclusione dal contraddirsi in un procedimento" },
  custom: { front: "Termine", back: "La definizione che vuoi ricordare" },
};

/** Map FolderKind → short display label with the flag/icon hint. */
export const FOLDER_LABELS: Record<FolderKind, string> = {
  jp: "🇯🇵 Giapponese",
  medicine: "Medicina",
  es: "🇪🇸 Spagnolo",
  law: "Diritto",
  custom: "Altro",
};
