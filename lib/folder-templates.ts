/**
 * Pure helpers per il flusso "Cosa vuoi ricordare?" (app/choose-topic.tsx)
 * e per chiunque trasformi una scelta della tassonomia in una riga folders.
 *
 * Dal 2026-09-02 l'identità di una cartella è folders.id e la scelta passa
 * dalla tassonomia (lib/folder-taxonomy.ts), non più dai 4 template chiusi.
 *
 * No React, no Supabase — unit-tested in folder-templates.test.ts.
 */

import { FOLDER_NAME_MAX_LENGTH } from "./constants";
import {
  CUSTOM_FOLDER_EMOJI,
  type FolderCategory,
  type TaxonomySub,
} from "./folder-taxonomy";
import { t } from "@/lib/i18n";

/** Quello che serve a createFolder. */
export type NewFolderInput = {
  name: string;
  category: FolderCategory;
  /** Sottocategoria della tassonomia; null = cartella personalizzata. */
  templateId: string | null;
  emoji: string;
};

export type FolderNameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: "empty" | "too-long"; message: string };

/**
 * Validate a custom folder name: trim, collapse inner whitespace, 1–40
 * chars. The DB accepts up to 120; 40 keeps it readable in the folder pill.
 */
export function validateFolderName(raw: string): FolderNameValidation {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0) {
    return { ok: false, reason: "empty", message: t("folderTemplates.nameEmpty") };
  }
  if (name.length > FOLDER_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: "too-long",
      message: t("folderTemplates.nameTooLong", { max: FOLDER_NAME_MAX_LENGTH }),
    };
  }
  return { ok: true, name };
}

/**
 * Priority for the next folder: 1 when the user has none, otherwise
 * max(existing)+1. Priorities are 1-based and sort ascending.
 */
export function nextFolderPriority(existing: ReadonlyArray<{ priority: number }>): number {
  let max = 0;
  for (const f of existing) if (f.priority > max) max = f.priority;
  return max + 1;
}

/** Sottocategoria della tassonomia → input di createFolder. */
export function folderInputFromSubcategory(
  category: FolderCategory,
  sub: TaxonomySub,
): NewFolderInput {
  return { name: sub.name, category, templateId: sub.id, emoji: sub.emoji };
}

/**
 * Nome libero → input di createFolder. `category` è la macrocategoria da
 * cui l'utente è partito ("Altra lingua…" resta una lingua), o "custom"
 * dal box "Crea cartella personalizzata". Throws su nome invalido — i
 * chiamanti validano prima (validateFolderName) per il messaggio inline;
 * questa è l'ultima linea di difesa.
 */
export function folderInputFromCustomName(
  name: string,
  category: FolderCategory = "custom",
  emoji: string = CUSTOM_FOLDER_EMOJI,
): NewFolderInput {
  const v = validateFolderName(name);
  if (!v.ok) throw new Error(v.message);
  return { name: v.name, category, templateId: null, emoji };
}
