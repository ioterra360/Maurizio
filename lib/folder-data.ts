/**
 * DEMO-MODE mock content for the four folder templates (demo accounts still
 * show four folders so the offline UI stays reviewable). Real users start
 * with ONE folder picked at onboarding — see lib/folder-templates.ts.
 * Mirrors the design contract in _design_drop/memika/project/folder-screen.jsx.
 *
 * Every user-facing string resolves through `t()` at access time (seed built
 * per call, getters on the exported records) so the Settings language switch
 * applies at once — never cache translated text at module level.
 */

import { t } from "@/lib/i18n";

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
  /** Memory id — present for real rows and demo rows built by fetchFolderDetail. */
  id?: string;
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

/**
 * Built on every call so `name` / card text come out in the current locale.
 * `reviewed` stays an English machine label — lib/api.ts round-trips it
 * through isoFromRelativeLabel, it is never shown as-is.
 */
function buildFolders(): Record<TemplateKind, FolderSeed> {
  return {
    jp: {
      kind: "jp",
      name: t("constants.templateJpName"),
      priority: 1,
      count: 247,
      active: 78,
      fading: 16,
      archived: 6,
      addedThisWeek: 6,
      items: [
        { front: "中心", reading: "chūshin", back: t("folderData.jpChushinBack"), state: "active", reviewed: "2 days ago", layer: "focus" },
        { front: "時間", reading: "jikan", back: t("folderData.jpJikanBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: "友達", reading: "tomodachi", back: t("folderData.jpTomodachiBack"), state: "active", reviewed: "3 days ago", layer: "reinforcement" },
        { front: "完璧", reading: "kanpeki", back: t("folderData.jpKanpekiBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: "希望", reading: "kibō", back: t("folderData.jpKibouBack"), state: "active", reviewed: "4 days ago", layer: "reinforcement" },
        { front: "医者", reading: "isha", back: t("folderData.jpIshaBack"), state: "active", reviewed: "5 days ago", layer: "reinforcement" },
        { front: "難しい", reading: "muzukashii", back: t("folderData.jpMuzukashiiBack"), state: "fading", reviewed: "12 days ago", layer: "scan" },
        { front: "散歩", reading: "sanpo", back: t("folderData.jpSanpoBack"), state: "fading", reviewed: "18 days ago", layer: "scan" },
        { front: "厳しい", reading: "kibishii", back: t("folderData.jpKibishiiBack"), state: "archived", reviewed: "2 months ago" },
      ],
    },
    medicine: {
      kind: "medicine",
      name: t("constants.templateMedicineName"),
      priority: 2,
      count: 312,
      active: 71,
      fading: 21,
      archived: 8,
      addedThisWeek: 4,
      items: [
        { front: t("folderData.medTachycardiaFront"), back: t("folderData.medTachycardiaBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: t("folderData.medBradycardiaFront"), back: t("folderData.medBradycardiaBack"), state: "active", reviewed: "2 days ago", layer: "reinforcement" },
        { front: t("folderData.medMitosisFront"), back: t("folderData.medMitosisBack"), state: "active", reviewed: "4 days ago", layer: "reinforcement" },
        { front: t("folderData.medSynapseFront"), back: t("folderData.medSynapseBack"), state: "active", reviewed: "3 days ago", layer: "reinforcement" },
        { front: t("folderData.medEdemaFront"), back: t("folderData.medEdemaBack"), state: "active", reviewed: "6 days ago", layer: "scan" },
        { front: t("folderData.medAuscultationFront"), back: t("folderData.medAuscultationBack"), state: "fading", reviewed: "11 days ago", layer: "scan" },
        { front: t("folderData.medApoptosisFront"), back: t("folderData.medApoptosisBack"), state: "fading", reviewed: "14 days ago", layer: "scan" },
        { front: t("folderData.medAtrialFibrillationFront"), back: t("folderData.medAtrialFibrillationBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: t("folderData.medPruritusFront"), back: t("folderData.medPruritusBack"), state: "archived", reviewed: "3 months ago" },
      ],
    },
    es: {
      kind: "es",
      name: t("constants.templateEsName"),
      priority: 3,
      count: 132,
      active: 65,
      fading: 25,
      archived: 10,
      addedThisWeek: 2,
      items: [
        { front: "ámbito", back: t("folderData.esAmbitoBack"), state: "active", reviewed: "2 days ago", layer: "reinforcement" },
        { front: "biblioteca", back: t("folderData.esBibliotecaBack"), state: "active", reviewed: "4 days ago", layer: "scan" },
        { front: "aprender", back: t("folderData.esAprenderBack"), state: "active", reviewed: "3 days ago", layer: "scan" },
        { front: "entender", back: t("folderData.esEntenderBack"), state: "active", reviewed: "5 days ago", layer: "reinforcement" },
        { front: "recordar", back: t("folderData.esRecordarBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: "amanecer", back: t("folderData.esAmanecerBack"), state: "active", reviewed: "6 days ago", layer: "scan" },
        { front: "desarrollar", back: t("folderData.esDesarrollarBack"), state: "fading", reviewed: "13 days ago", layer: "scan" },
        { front: "olvidar", back: t("folderData.esOlvidarBack"), state: "fading", reviewed: "16 days ago", layer: "scan" },
        { front: "escabullirse", back: t("folderData.esEscabullirseBack"), state: "archived", reviewed: "2 months ago" },
      ],
    },
    law: {
      kind: "law",
      name: t("constants.templateLawName"),
      priority: 4,
      count: 88,
      active: 52,
      fading: 33,
      archived: 15,
      addedThisWeek: 3,
      items: [
        { front: "Estoppel", back: t("folderData.lawEstoppelBack"), state: "active", reviewed: "Yesterday", layer: "focus" },
        { front: "Habeas corpus", back: t("folderData.lawHabeasCorpusBack"), state: "active", reviewed: "3 days ago", layer: "reinforcement" },
        { front: "Tort", back: t("folderData.lawTortBack"), state: "active", reviewed: "4 days ago", layer: "reinforcement" },
        { front: "Prima facie", back: t("folderData.lawPrimaFacieBack"), state: "active", reviewed: "6 days ago", layer: "scan" },
        { front: "Mens rea", back: t("folderData.lawMensReaBack"), state: "active", reviewed: "5 days ago", layer: "reinforcement" },
        { front: "Res judicata", back: t("folderData.lawResJudicataBack"), state: "fading", reviewed: "12 days ago", layer: "scan" },
        { front: "Stare decisis", back: t("folderData.lawStareDecisisBack"), state: "fading", reviewed: "15 days ago", layer: "scan" },
        { front: "Caveat emptor", back: t("folderData.lawCaveatEmptorBack"), state: "fading", reviewed: "20 days ago", layer: "scan" },
        { front: "Voir dire", back: t("folderData.lawVoirDireBack"), state: "archived", reviewed: "3 months ago" },
      ],
    },
  };
}

/** Demo seed for a kind — undefined for `custom` (no mock content). */
export function getFolderSeed(kind: FolderKind): FolderSeed | undefined {
  return (buildFolders() as Partial<Record<FolderKind, FolderSeed>>)[kind];
}

export function getAllFolderSeeds(): FolderSeed[] {
  const folders = buildFolders();
  return [folders.jp, folders.medicine, folders.es, folders.law];
}

export type { ItemTypeOption };

/**
 * Item-type chips per folder kind, used by the Add screen. Templates carry
 * their own (lib/constants.ts); a custom folder gets the generic set.
 */
export const ITEM_TYPES_BY_KIND: Record<FolderKind, readonly ItemTypeOption[]> = {
  ...(Object.fromEntries(FOLDER_TEMPLATES.map((template) => [template.kind, template.itemTypes])) as Record<
    TemplateKind,
    readonly ItemTypeOption[]
  >),
  [CUSTOM_FOLDER_KIND]: CUSTOM_ITEM_TYPES,
};

/** Preview cards used in the Add-to-Memory preview tile. Text resolves on access. */
export const ADD_PREVIEW_BY_KIND: Record<FolderKind, { front: string; back: string }> = {
  jp: {
    front: "中心",
    get back() {
      return t("folderData.addPreviewJpBack");
    },
  },
  medicine: {
    get front() {
      return t("folderData.medTachycardiaFront");
    },
    get back() {
      return t("folderData.medTachycardiaBack");
    },
  },
  es: {
    front: "ámbito",
    get back() {
      return t("folderData.esAmbitoBack");
    },
  },
  law: {
    front: "Estoppel",
    get back() {
      return t("folderData.addPreviewLawBack");
    },
  },
  custom: {
    get front() {
      return t("folderData.addPreviewCustomFront");
    },
    get back() {
      return t("folderData.addPreviewCustomBack");
    },
  },
};

/** Map FolderKind → short display label with the flag/icon hint. Resolves on access. */
export const FOLDER_LABELS: Record<FolderKind, string> = {
  get jp() {
    return t("folderData.labelJp");
  },
  get medicine() {
    return t("folderData.labelMedicine");
  },
  get es() {
    return t("folderData.labelEs");
  },
  get law() {
    return t("folderData.labelLaw");
  },
  get custom() {
    return t("folderData.labelCustom");
  },
};
