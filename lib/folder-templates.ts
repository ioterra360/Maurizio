/**
 * Pure helpers for the "Scegli il tuo argomento" step (app/choose-topic.tsx)
 * and for anything that turns a template / custom name into a folder row.
 *
 * No React, no Supabase — unit-tested in folder-templates.test.ts.
 */

import {
  CUSTOM_FOLDER_KIND,
  CUSTOM_ITEM_TYPES,
  FOLDER_NAME_MAX_LENGTH,
  FOLDER_TEMPLATES,
  TEMPLATE_KINDS,
  type FolderKind,
  type FolderTemplate,
  type ItemTypeOption,
  type TemplateKind,
} from "./constants";

/** What createFolder needs. itemTypes are client-side (keyed by kind). */
export type NewFolderInput = {
  kind: FolderKind;
  name: string;
  itemTypes: readonly ItemTypeOption[];
};

/** The user's choice on the topic-pick step. */
export type TopicChoice =
  | { type: "template"; kind: TemplateKind }
  | { type: "custom"; name: string };

export function isTemplateKind(kind: string | null | undefined): kind is TemplateKind {
  return (TEMPLATE_KINDS as readonly string[]).includes(kind ?? "");
}

export function getTemplate(kind: TemplateKind): FolderTemplate {
  const t = FOLDER_TEMPLATES.find((x) => x.kind === kind);
  // FOLDER_TEMPLATES covers every TemplateKind by construction.
  if (!t) throw new Error(`Unknown folder template: ${kind}`);
  return t;
}

/** Item-type chips for any folder kind (templates + custom). */
export function itemTypesForKind(kind: FolderKind): readonly ItemTypeOption[] {
  return isTemplateKind(kind) ? getTemplate(kind).itemTypes : CUSTOM_ITEM_TYPES;
}

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
    return { ok: false, reason: "empty", message: "Dai un nome al tuo argomento." };
  }
  if (name.length > FOLDER_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: "too-long",
      message: `Massimo ${FOLDER_NAME_MAX_LENGTH} caratteri.`,
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

/**
 * Turn the topic-pick choice into a createFolder input. Throws on an invalid
 * custom name — callers validate first (validateFolderName) to show the
 * message inline; this is the last line of defence.
 */
export function folderInputFromChoice(choice: TopicChoice): NewFolderInput {
  if (choice.type === "template") {
    const t = getTemplate(choice.kind);
    return { kind: t.kind, name: t.name, itemTypes: t.itemTypes };
  }
  const v = validateFolderName(choice.name);
  if (!v.ok) throw new Error(v.message);
  return { kind: CUSTOM_FOLDER_KIND, name: v.name, itemTypes: CUSTOM_ITEM_TYPES };
}
