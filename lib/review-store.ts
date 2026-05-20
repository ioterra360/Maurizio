import { create } from "zustand";
import type { LayerKey } from "@/theme/tokens";

import { useAuthStore } from "./auth-store";
import {
  applyScheduledUpdate,
  completeReviewSession,
  recordReviewItem,
  startReviewSession,
} from "./api";
import { update as scheduleUpdate } from "@/features/srs/scheduler";
import { initialSrsState, type LayerOutcome, type SrsState } from "@/features/srs/types";
import type { ReviewResponse } from "./constants";

export type ReviewCard = {
  /** Stable id so persistence keeps SRS state per-card across reviews. */
  id: string;
  front: string;
  reading?: string;
  back: string;
  example?: string;
  folder: string;
};

const SCAN_CARDS: ReviewCard[] = [
  { id: "demo-scan-0", front: "biblioteca",   back: "Library",                             folder: "Spanish"  },
  { id: "demo-scan-1", front: "Pruritus",     back: "Itching sensation",                   folder: "Medicine" },
  { id: "demo-scan-2", front: "難しい", reading: "muzukashii", back: "Difficult · hard · challenging", folder: "Japanese" },
  { id: "demo-scan-3", front: "Caveat emptor", back: "Let the buyer beware",               folder: "Law"      },
];

const REINF_CARDS: ReviewCard[] = [
  { id: "demo-reinf-0", front: "amanecer", back: "Dawn · sunrise · daybreak",          folder: "Spanish"  },
  { id: "demo-reinf-1", front: "Synapse",  back: "Junction between two neurons",       folder: "Medicine" },
  { id: "demo-reinf-2", front: "希望", reading: "kibō", back: "Hope · wish · aspiration", folder: "Japanese" },
];

const FOCUS_CARDS: ReviewCard[] = [
  { id: "demo-focus-0", front: "中心",   reading: "chūshin",  back: "Center · core · the middle",         example: "Memora は学習の中心です",                  folder: "Japanese" },
  { id: "demo-focus-1", front: "完璧",   reading: "kanpeki", back: "Perfect · flawless · complete",       example: "完璧な仕事です",                             folder: "Japanese" },
  { id: "demo-focus-2", front: "Estoppel", back: "Preclusion of contradiction in legal proceedings",      example: "The court invoked estoppel.",              folder: "Law" },
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

const EMPTY_COUNTS: Counts = { remembered: 0, struggled: 0, forgot: 0, reviewed: 0 };

/**
 * Translate a Focus-screen response + the layer the card is currently on
 * into the LayerOutcome the scheduler understands.
 *
 * The Scan and Reinforcement screens both call recordAndAdvance with
 * "remembered" | "struggled" | "forgot" too — we map them to the closest
 * layer-native outcome per docs/SRS.md so the SM-2 quality is correct:
 *   scan:          remembered → remember (q=4),   forgot/struggled → show (q=2)
 *   reinforcement: remembered → continue (q=4),   forgot/struggled → again (q=1)
 *   focus:         passthrough — already matches the Focus screen vocabulary.
 */
function toLayerOutcome(layer: LayerKey, response: ReviewResponse): LayerOutcome {
  switch (layer) {
    case "scan":
      return { layer: "scan", outcome: response === "remembered" ? "remember" : "show" };
    case "reinforcement":
      return { layer: "reinforcement", outcome: response === "remembered" ? "continue" : "again" };
    case "focus":
      if (response === "remembered") return { layer: "focus", outcome: "remembered" };
      if (response === "struggled") return { layer: "focus", outcome: "struggled" };
      return { layer: "focus", outcome: "forgot" };
  }
}

type ReviewState = {
  /** "flow" = Scan → Reinforcement → Focus → Complete; "single" = one layer only. */
  mode: "flow" | "single";
  layer: LayerKey;
  index: number;
  totals: Counts;
  /** Server session id (real or demo synthetic). Null before start() runs. */
  sessionId: string | null;
  /** SRS state per card id — initialized lazily and updated in place. */
  srsByCard: Record<string, SrsState>;
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
  totals: EMPTY_COUNTS,
  sessionId: null,
  srsByCard: {},

  /**
   * Begin a session from layer 0. CALLERS BEWARE: this resets totals.
   * Re-entering an in-flight session must NOT call start() — guard with
   * `if (state.layer !== targetLayer || state.index === 0)` at the call site.
   *
   * Synchronous on the surface — the server session id arrives on a follow-
   * up tick via the api layer (in demo mode this resolves immediately).
   */
  start: (layer, mode) => {
    set({ layer, mode, index: 0, totals: EMPTY_COUNTS, sessionId: null });
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    startReviewSession(userId, layer)
      .then((session) => {
        // Only commit if no other start() has happened in the meantime.
        if (get().layer === layer && get().index === 0) {
          set({ sessionId: session.id });
        }
      })
      .catch((e) => {
        if (__DEV__) console.warn("[review] startReviewSession failed", e);
      });
  },

  setLayer: (layer) => set({ layer, index: 0 }),

  cards: () => DECKS[get().layer],
  current: () => DECKS[get().layer][get().index],

  recordAndAdvance: (response) => {
    const state = get();
    const cards = DECKS[state.layer];
    const card = cards[state.index];
    const totals: Counts = {
      remembered: state.totals.remembered + (response === "remembered" ? 1 : 0),
      struggled: state.totals.struggled + (response === "struggled" ? 1 : 0),
      forgot: state.totals.forgot + (response === "forgot" ? 1 : 0),
      reviewed: state.totals.reviewed + 1,
    };

    // Run the scheduler + persist asynchronously. This is a side-effect we
    // intentionally fire-and-forget — the UI advances on the synchronous
    // setState below and the persistence completes in the background. Any
    // failure is logged in __DEV__; production telemetry comes in Phase 4.
    if (card) {
      const userId = useAuthStore.getState().user?.id;
      const prior = state.srsByCard[card.id] ?? initialSrsState();
      const updated = scheduleUpdate(prior, toLayerOutcome(state.layer, response));
      set({
        srsByCard: { ...state.srsByCard, [card.id]: updated },
      });
      if (userId && state.sessionId) {
        void Promise.all([
          recordReviewItem({
            sessionId: state.sessionId,
            memoryId: card.id,
            userId,
            response,
          }),
          applyScheduledUpdate(card.id, updated),
        ]).catch((e) => {
          if (__DEV__) console.warn("[review] persist failed for card", card.id, e);
        });
      }
    }

    const nextIndex = state.index + 1;
    if (nextIndex < cards.length) {
      set({ index: nextIndex, totals });
      return "next";
    }

    // End of layer
    if (state.mode === "flow") {
      if (state.layer === "scan" || state.layer === "reinforcement") {
        set({ totals });
        return "handoff";
      }
    }
    // End of session (single layer mode, or end of focus in flow mode).
    set({ totals });
    if (state.sessionId) {
      void completeReviewSession(state.sessionId, totals).catch((e) => {
        if (__DEV__) console.warn("[review] completeReviewSession failed", e);
      });
    }
    return "done";
  },

  reset: () =>
    set({
      mode: "single",
      layer: "scan",
      index: 0,
      totals: EMPTY_COUNTS,
      sessionId: null,
      srsByCard: {},
    }),
}));
