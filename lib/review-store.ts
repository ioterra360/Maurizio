import { create } from "zustand";
import type { LayerKey } from "@/theme/tokens";

export type ReviewCard = {
  front: string;
  reading?: string;
  back: string;
  example?: string;
  folder: string;
};

const SCAN_CARDS: ReviewCard[] = [
  { front: "biblioteca", back: "Library", folder: "Spanish" },
  { front: "Pruritus",   back: "Itching sensation", folder: "Medicine" },
  { front: "難しい",      reading: "muzukashii", back: "Difficult · hard · challenging", folder: "Japanese" },
  { front: "Caveat emptor", back: "Let the buyer beware", folder: "Law" },
];

const REINF_CARDS: ReviewCard[] = [
  { front: "amanecer", back: "Dawn · sunrise · daybreak", folder: "Spanish" },
  { front: "Synapse",  back: "Junction between two neurons", folder: "Medicine" },
  { front: "希望",      reading: "kibō", back: "Hope · wish · aspiration", folder: "Japanese" },
];

const FOCUS_CARDS: ReviewCard[] = [
  { front: "中心",   reading: "chūshin",  back: "Center · core · the middle",         example: "Memora は学習の中心です",                  folder: "Japanese" },
  { front: "完璧",   reading: "kanpeki", back: "Perfect · flawless · complete",       example: "完璧な仕事です",                             folder: "Japanese" },
  { front: "Estoppel", back: "Preclusion of contradiction in legal proceedings",       example: "The court invoked estoppel.",              folder: "Law" },
];

const DECKS: Record<LayerKey, ReviewCard[]> = {
  scan: SCAN_CARDS,
  reinforcement: REINF_CARDS,
  focus: FOCUS_CARDS,
};

export type Counts = {
  remembered: number;
  struggled: number;
  forgot: number;
  reviewed: number;
};

type ReviewState = {
  /** "flow" = Scan → Reinforcement → Focus → Complete; "single" = one layer only. */
  mode: "flow" | "single";
  layer: LayerKey;
  index: number;
  totals: Counts;
  start: (layer: LayerKey, mode: "flow" | "single") => void;
  recordAndAdvance: (response: "remembered" | "struggled" | "forgot") => "next" | "handoff" | "done";
  cards: () => ReviewCard[];
  current: () => ReviewCard | undefined;
  reset: () => void;
  setLayer: (layer: LayerKey) => void;
};

export const useReviewStore = create<ReviewState>((set, get) => ({
  mode: "single",
  layer: "scan",
  index: 0,
  totals: { remembered: 0, struggled: 0, forgot: 0, reviewed: 0 },

  /**
   * Begin a session from layer 0. CALLERS BEWARE: this resets totals.
   * Re-entering an in-flight session must NOT call start() — guard with
   * `if (state.layer !== targetLayer || state.index === 0)` at the call site.
   */
  start: (layer, mode) =>
    set({ layer, mode, index: 0, totals: { remembered: 0, struggled: 0, forgot: 0, reviewed: 0 } }),

  setLayer: (layer) => set({ layer, index: 0 }),

  cards: () => DECKS[get().layer],
  current: () => DECKS[get().layer][get().index],

  recordAndAdvance: (response) => {
    const state = get();
    const cards = DECKS[state.layer];
    const totals = {
      remembered: state.totals.remembered + (response === "remembered" ? 1 : 0),
      struggled: state.totals.struggled + (response === "struggled" ? 1 : 0),
      forgot: state.totals.forgot + (response === "forgot" ? 1 : 0),
      reviewed: state.totals.reviewed + 1,
    };
    const nextIndex = state.index + 1;
    if (nextIndex < cards.length) {
      set({ index: nextIndex, totals });
      return "next";
    }
    // End of layer
    if (state.mode === "flow") {
      if (state.layer === "scan") {
        set({ totals });
        return "handoff";
      }
      if (state.layer === "reinforcement") {
        set({ totals });
        return "handoff";
      }
    }
    set({ totals });
    return "done";
  },

  reset: () =>
    set({
      mode: "single",
      layer: "scan",
      index: 0,
      totals: { remembered: 0, struggled: 0, forgot: 0, reviewed: 0 },
    }),
}));
