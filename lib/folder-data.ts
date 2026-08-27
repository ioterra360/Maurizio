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
      { front: "中心", reading: "chūshin", back: "Centro · nucleo · il punto centrale", state: "active", reviewed: "2 days ago", layer: "focus" },
      { front: "時間", reading: "jikan", back: "Tempo · ora", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "友達", reading: "tomodachi", back: "Amico · amica", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "完璧", reading: "kanpeki", back: "Perfetto · impeccabile · completo", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "希望", reading: "kibō", back: "Speranza · desiderio · aspirazione", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "医者", reading: "isha", back: "Medico · dottore", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "難しい", reading: "muzukashii", back: "Difficile · complicato · impegnativo", state: "fading", reviewed: "12 days ago", layer: "scan" },
      { front: "散歩", reading: "sanpo", back: "Passeggiata · giro a piedi", state: "fading", reviewed: "18 days ago", layer: "scan" },
      { front: "厳しい", reading: "kibishii", back: "Severo · rigoroso", state: "archived", reviewed: "2 months ago" },
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
      { front: "Tachicardia", back: "Frequenza cardiaca a riposo sopra i 100 bpm", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Bradicardia", back: "Frequenza cardiaca più lenta del normale", state: "active", reviewed: "2 days ago", layer: "reinforcement" },
      { front: "Mitosi", back: "Divisione cellulare che produce due cellule figlie identiche", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "Sinapsi", back: "Giunzione tra due neuroni", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "Edema", back: "Accumulo anomalo di liquidi nei tessuti", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "Auscultazione", back: "Ascolto dei suoni interni del corpo con lo stetoscopio", state: "fading", reviewed: "11 days ago", layer: "scan" },
      { front: "Apoptosi", back: "Morte cellulare programmata", state: "fading", reviewed: "14 days ago", layer: "scan" },
      { front: "Fibrillazione atriale", back: "Ritmo cardiaco irregolare, spesso rapido", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Prurito", back: "Sensazione che induce a grattarsi", state: "archived", reviewed: "3 months ago" },
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
      { front: "ámbito", back: "Ambito · sfera · campo d'azione", state: "active", reviewed: "2 days ago", layer: "reinforcement" },
      { front: "biblioteca", back: "Biblioteca", state: "active", reviewed: "4 days ago", layer: "scan" },
      { front: "aprender", back: "Imparare · apprendere", state: "active", reviewed: "3 days ago", layer: "scan" },
      { front: "entender", back: "Capire · comprendere", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "recordar", back: "Ricordare · rammentare", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "amanecer", back: "Alba · aurora · il sorgere del sole", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "desarrollar", back: "Sviluppare · far crescere", state: "fading", reviewed: "13 days ago", layer: "scan" },
      { front: "olvidar", back: "Dimenticare · lasciarsi alle spalle", state: "fading", reviewed: "16 days ago", layer: "scan" },
      { front: "escabullirse", back: "Svignarsela · sgattaiolare via", state: "archived", reviewed: "2 months ago" },
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
      { front: "Estoppel", back: "Preclusione: non ci si può contraddire in giudizio", state: "active", reviewed: "Yesterday", layer: "focus" },
      { front: "Habeas corpus", back: "Diritto di contestare una detenzione illegittima", state: "active", reviewed: "3 days ago", layer: "reinforcement" },
      { front: "Tort", back: "Illecito civile che causa un danno", state: "active", reviewed: "4 days ago", layer: "reinforcement" },
      { front: "Prima facie", back: "A prima vista · in apparenza", state: "active", reviewed: "6 days ago", layer: "scan" },
      { front: "Mens rea", back: "Elemento soggettivo · l'intenzione dietro l'atto", state: "active", reviewed: "5 days ago", layer: "reinforcement" },
      { front: "Res judicata", back: "Cosa giudicata · non si può riprocessare", state: "fading", reviewed: "12 days ago", layer: "scan" },
      { front: "Stare decisis", back: "Attenersi a quanto deciso · regola del precedente", state: "fading", reviewed: "15 days ago", layer: "scan" },
      { front: "Caveat emptor", back: "Il compratore stia attento — il rischio è dell'acquirente", state: "fading", reviewed: "20 days ago", layer: "scan" },
      { front: "Voir dire", back: "Esame preliminare dei giurati", state: "archived", reviewed: "3 months ago" },
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
