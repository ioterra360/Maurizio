/**
 * La tassonomia delle cartelle (Maurizio 2026-09-01): quattro macrocategorie
 * — Lingue, Materie, Lavoro, Interessi — ognuna con le sue sottocategorie.
 * "Esami e certificazioni" è ESCLUSA per decisione esplicita di Angelo.
 *
 * Dato puro: niente React, niente Supabase. Le etichette sono getter che
 * risolvono t() all'accesso, così seguono il cambio lingua a runtime (mai
 * cache di stringhe tradotte in costanti di modulo — regola AGENTS.md §3).
 *
 * Gli id delle sottocategorie sono GLOBALMENTE unici (finiscono in
 * folders.template_id): dove un nome ricorre in due macrocategorie
 * (Marketing, Psicologia, Geografia, Storia — è voluto, inquadrano cose
 * diverse) l'id porta un suffisso.
 */

import { t, type TKey } from "@/lib/i18n";
import {
  CUSTOM_ITEM_TYPES,
  type ItemTypeOption,
} from "./constants";

export const FOLDER_CATEGORIES = ["lingue", "materie", "lavoro", "interessi", "custom"] as const;
export type FolderCategory = (typeof FOLDER_CATEGORIES)[number];
export type MacroCategory = Exclude<FolderCategory, "custom">;

export type TaxonomySub = {
  /** Id stabile → folders.template_id. Non cambia mai. */
  id: string;
  emoji: string;
  /** Nome localizzato, risolto all'accesso. */
  name: string;
};

export type TaxonomyCategory = {
  id: MacroCategory;
  emoji: string;
  name: string;
  hint: string;
  /** Etichetta della voce libera in fondo al selettore ("Altra lingua…"). */
  otherLabel: string;
  subcategories: readonly TaxonomySub[];
};

const sub = (id: string, emoji: string, nameKey: TKey): TaxonomySub => ({
  id,
  emoji,
  get name() {
    return t(nameKey);
  },
});

export const TAXONOMY: readonly TaxonomyCategory[] = [
  {
    id: "lingue",
    emoji: "🌐",
    get name() {
      return t("taxonomy.catLingue");
    },
    get hint() {
      return t("taxonomy.catLingueHint");
    },
    get otherLabel() {
      return t("taxonomy.otherLingue");
    },
    subcategories: [
      sub("ja", "🇯🇵", "taxonomy.ja"),
      sub("es", "🇪🇸", "taxonomy.es"),
      sub("fr", "🇫🇷", "taxonomy.fr"),
      sub("it", "🇮🇹", "taxonomy.it"),
      sub("pt", "🇵🇹", "taxonomy.pt"),
      sub("de", "🇩🇪", "taxonomy.de"),
      sub("ko", "🇰🇷", "taxonomy.ko"),
      sub("ar", "🇸🇦", "taxonomy.ar"),
      sub("ru", "🇷🇺", "taxonomy.ru"),
      sub("hi", "🇮🇳", "taxonomy.hi"),
      sub("zh", "🇨🇳", "taxonomy.zh"),
    ],
  },
  {
    id: "materie",
    emoji: "🎓",
    get name() {
      return t("taxonomy.catMaterie");
    },
    get hint() {
      return t("taxonomy.catMaterieHint");
    },
    get otherLabel() {
      return t("taxonomy.otherMaterie");
    },
    subcategories: [
      sub("psicologia", "🧠", "taxonomy.psicologia"),
      sub("medicina", "🩺", "taxonomy.medicina"),
      sub("diritto", "⚖️", "taxonomy.diritto"),
      sub("finanza", "💰", "taxonomy.finanza"),
      sub("marketing", "📊", "taxonomy.marketing"),
      sub("management", "📈", "taxonomy.management"),
      sub("fisica", "⚛️", "taxonomy.fisica"),
      sub("chimica", "🧪", "taxonomy.chimica"),
      sub("geografia", "🌍", "taxonomy.geografia"),
      sub("storia", "🏛️", "taxonomy.storia"),
      sub("filosofia", "💭", "taxonomy.filosofia"),
    ],
  },
  {
    id: "lavoro",
    emoji: "🧑‍💼",
    get name() {
      return t("taxonomy.catLavoro");
    },
    get hint() {
      return t("taxonomy.catLavoroHint");
    },
    get otherLabel() {
      return t("taxonomy.otherLavoro");
    },
    subcategories: [
      sub("business", "💼", "taxonomy.business"),
      sub("programmazione", "💻", "taxonomy.programmazione"),
      sub("marketing-pro", "📊", "taxonomy.marketingPro"),
      sub("contabilita", "💰", "taxonomy.contabilita"),
      sub("sanita", "🏥", "taxonomy.sanita"),
      sub("insegnamento", "👩‍🏫", "taxonomy.insegnamento"),
      sub("turismo", "🏨", "taxonomy.turismo"),
      sub("ristorazione", "🍽️", "taxonomy.ristorazione"),
      sub("ingegneria", "🏗️", "taxonomy.ingegneria"),
      sub("legale", "🧑‍⚖️", "taxonomy.legale"),
    ],
  },
  {
    id: "interessi",
    emoji: "🌟",
    get name() {
      return t("taxonomy.catInteressi");
    },
    get hint() {
      return t("taxonomy.catInteressiHint");
    },
    get otherLabel() {
      return t("taxonomy.otherInteressi");
    },
    subcategories: [
      sub("geografia-int", "🌍", "taxonomy.geografiaInt"),
      sub("storia-int", "🏛️", "taxonomy.storiaInt"),
      sub("arte", "🎨", "taxonomy.arte"),
      sub("musica", "🎵", "taxonomy.musica"),
      sub("cinema", "🎬", "taxonomy.cinema"),
      sub("letteratura", "📚", "taxonomy.letteratura"),
      sub("psicologia-int", "🧠", "taxonomy.psicologiaInt"),
      sub("scienza", "🔬", "taxonomy.scienza"),
      sub("natura", "🌱", "taxonomy.natura"),
      sub("vino", "🍷", "taxonomy.vino"),
      sub("cucina", "🍳", "taxonomy.cucina"),
      sub("sport", "🏃", "taxonomy.sport"),
    ],
  },
];

export function categoryById(id: string | null | undefined): TaxonomyCategory | null {
  return TAXONOMY.find((c) => c.id === id) ?? null;
}

export function subById(templateId: string | null | undefined): TaxonomySub | null {
  if (!templateId) return null;
  for (const c of TAXONOMY) {
    const s = c.subcategories.find((x) => x.id === templateId);
    if (s) return s;
  }
  return null;
}

/** Emoji di ripiego per una cartella senza template (personalizzata). */
export const CUSTOM_FOLDER_EMOJI = "📁";

const langChip = (value: string, key: TKey): ItemTypeOption => ({
  value,
  get label() {
    return t(key);
  },
});

const LINGUE_TYPES: readonly ItemTypeOption[] = [
  langChip("word", "constants.itemTypeWord"),
  langChip("verb", "constants.itemTypeVerb"),
  langChip("grammar", "constants.itemTypeGrammar"),
  langChip("phrase", "constants.itemTypePhrase"),
];

/**
 * Chip specifiche per template dove il dominio le richiede (il giapponese
 * ha i kanji, la medicina i farmaci, il diritto dottrina/casi/norme —
 * erano i vecchi template e la specificità va conservata).
 */
const TEMPLATE_ITEM_TYPES: Record<string, readonly ItemTypeOption[]> = {
  ja: [
    langChip("word", "constants.itemTypeWord"),
    langChip("kanji", "constants.itemTypeKanji"),
    langChip("grammar", "constants.itemTypeGrammar"),
    langChip("phrase", "constants.itemTypePhrase"),
  ],
  medicina: [
    langChip("term", "constants.itemTypeTerm"),
    langChip("concept", "constants.itemTypeConcept"),
    langChip("drug", "constants.itemTypeDrug"),
    langChip("fact", "constants.itemTypeFact"),
  ],
  diritto: [
    langChip("doctrine", "constants.itemTypeDoctrine"),
    langChip("case", "constants.itemTypeCase"),
    langChip("statute", "constants.itemTypeStatute"),
    langChip("term", "constants.itemTypeTerm"),
  ],
};

/** Chip dei tipi di elemento per una cartella, da categoria + template. */
export function itemTypesFor(
  category: FolderCategory | null | undefined,
  templateId?: string | null,
): readonly ItemTypeOption[] {
  if (templateId && TEMPLATE_ITEM_TYPES[templateId]) return TEMPLATE_ITEM_TYPES[templateId];
  if (category === "lingue") return LINGUE_TYPES;
  return CUSTOM_ITEM_TYPES;
}

/** Il campo "lettura" (romaji/pronuncia) ha senso solo per certe lingue. */
export function templateHasReading(templateId: string | null | undefined): boolean {
  return templateId === "ja" || templateId === "zh" || templateId === "ko";
}

/**
 * Mappa vecchio kind → (categoria, template, emoji) per il backfill e per
 * i client in transizione. Specchio del CASE nella migration 20260902130000.
 */
export const LEGACY_KIND_TO_TEMPLATE: Record<
  string,
  { category: FolderCategory; templateId: string | null; emoji: string }
> = {
  jp: { category: "lingue", templateId: "ja", emoji: "🇯🇵" },
  es: { category: "lingue", templateId: "es", emoji: "🇪🇸" },
  medicine: { category: "materie", templateId: "medicina", emoji: "🩺" },
  law: { category: "materie", templateId: "diritto", emoji: "⚖️" },
  custom: { category: "custom", templateId: null, emoji: CUSTOM_FOLDER_EMOJI },
};

/**
 * Kind legacy per una cartella nuova — i client vecchi (pre-OTA) leggono
 * ancora folders.kind per icona e chip. I quattro template storici mappano
 * sul loro kind, tutto il resto è "custom". Va via con la colonna kind.
 */
export function legacyKindFor(templateId: string | null | undefined): string {
  if (templateId === "ja") return "jp";
  if (templateId === "es") return "es";
  if (templateId === "medicina") return "medicine";
  if (templateId === "diritto") return "law";
  return "custom";
}

/** Filtro per la barra di ricerca del selettore: match su prefisso di parola, senza accenti. */
export function filterSubcategories(
  subs: readonly TaxonomySub[],
  query: string,
): readonly TaxonomySub[] {
  const q = normalize(query);
  if (!q) return subs;
  return subs.filter((s) =>
    normalize(s.name)
      .split(/\s+/)
      .some((w) => w.startsWith(q)),
  );
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
