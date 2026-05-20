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

type PendingItem = {
  memoryId: string;
  userId: string;
  response: ReviewResponse;
  reviewedAt: string;
};

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

/**
 * Static demo card ids look like `demo-scan-0`; they are NOT row ids in
 * public.memories. Until Phase 3D swaps the decks for fetchDueMemoriesByLayer
 * results, we must NOT send these to applyScheduledUpdate or recordReviewItem
 * in remote mode — Postgres would reject the FK and the fire-and-forget
 * catch would silently swallow it. Returns true when the id corresponds to a
 * real memories row.
 */
function isPersistableMemoryId(id: string): boolean {
  return !id.startsWith("demo-");
}

type ReviewState = {
  /** "flow" = Scan → Reinforcement → Focus → Complete; "single" = one layer only. */
  mode: "flow" | "single";
  layer: LayerKey;
  index: number;
  /** Cumulative across all layers in the current flow — Complete screen reads this. */
  totals: Counts;
  /** Per-layer counts — reset on each new layer, written to review_sessions on close. */
  layerTotals: Counts;
  /** Server session id for the CURRENT layer (real or demo synthetic). */
  sessionId: string | null;
  /**
   * Layer for which startReviewSession is currently in flight. Used by
   * ensureSession() to distinguish "no session yet because nobody opened
   * one" (single-layer direct entry) from "no session yet because the flow
   * handoff is still awaiting the server" (must not reset to single mode).
   */
  pendingSessionLayer: LayerKey | null;
  /**
   * Answers recorded before the layer's session id arrived from the server.
   * Flushed to recordReviewItem once openSessionFor resolves, keeping
   * review_items row counts in sync with review_sessions.items_reviewed.
   */
  pendingItems: PendingItem[];
  /** SRS state per card id — initialized lazily and updated in place. */
  srsByCard: Record<string, SrsState>;
  start: (layer: LayerKey, mode: "flow" | "single") => void;
  recordAndAdvance: (response: "remembered" | "struggled" | "forgot") => "next" | "handoff" | "done";
  cards: () => ReviewCard[];
  current: () => ReviewCard | undefined;
  reset: () => void;
  setLayer: (layer: LayerKey) => void;
  /**
   * Transition to the next layer in a flow review. Closes out the previous
   * layer's review_sessions row with that layer's counts, then opens a fresh
   * one for the new layer — preserving the cumulative `totals` so the
   * Complete screen still sees cross-layer numbers.
   */
  advanceToLayer: (next: LayerKey) => void;
  /**
   * Idempotent guard for "user entered a layer screen directly, without going
   * through the Scan starting point". If we already have an open session for
   * this layer, no-op. Otherwise, behave like start(layer, mode). Called from
   * the Reinforcement and Focus screen useFocusEffects so single-layer entry
   * from Today still persists a row.
   */
  ensureSession: (layer: LayerKey, mode: "flow" | "single") => void;
};

/**
 * Monotonic id for in-flight startReviewSession requests. Lets the resolve
 * handler tell its own request apart from a newer one — without this, two
 * rapid start()/advanceToLayer() calls could either drop the newer session
 * id (if we naively check sessionId === null) or accept a stale one.
 */
let openSessionSeq = 0;

/**
 * Open a new review_sessions row for `layer` and tag the store with its id.
 * Centralized so start(), advanceToLayer() and ensureSession() share the
 * same wire-up. While the request is in flight we flag
 * `pendingSessionLayer` so ensureSession() can tell the difference between
 * "no session yet because nobody asked" and "no session yet because the
 * handoff hasn't resolved". A stale response (one whose sequence has been
 * superseded by a newer start/advance/ensure) is dropped without touching
 * state.
 */
function openSessionFor(
  layer: LayerKey,
  set: (partial: Partial<ReviewState>) => void,
  get: () => ReviewState,
) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  const myId = ++openSessionSeq;
  set({ pendingSessionLayer: layer });
  startReviewSession(userId, layer)
    .then((session) => {
      // Newer request superseded this one — let that one own the state.
      if (myId !== openSessionSeq) return;
      const s = get();
      // Layer changed (advanceToLayer to a different layer, or reset/logout
      // bumped the seq above already → handled by the seq check). Index
      // intentionally NOT checked: rapid taps on the first card can bump
      // index to 1 before this resolves, and we still want the session id
      // attached so subsequent recordReviewItem calls land.
      if (s.layer !== layer) {
        set({ pendingSessionLayer: null });
        return;
      }
      const pending = s.pendingItems;
      set({ sessionId: session.id, pendingSessionLayer: null, pendingItems: [] });
      // Backfill any answers the user gave before the session id arrived,
      // so review_sessions.items_* and review_items rowcounts agree.
      if (pending.length > 0) {
        for (const p of pending) {
          void recordReviewItem({
            sessionId: session.id,
            memoryId: p.memoryId,
            userId: p.userId,
            response: p.response,
            reviewedAt: p.reviewedAt,
          }).catch((e) => {
            if (__DEV__) console.warn("[review] backfill recordReviewItem failed", e);
          });
        }
      }
    })
    .catch((e) => {
      if (myId === openSessionSeq) set({ pendingSessionLayer: null });
      if (__DEV__) console.warn("[review] startReviewSession failed", e);
    });
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  mode: "single",
  layer: "scan",
  index: 0,
  totals: EMPTY_COUNTS,
  layerTotals: EMPTY_COUNTS,
  sessionId: null,
  pendingSessionLayer: null,
  pendingItems: [],
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
    set({
      layer,
      mode,
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
    });
    openSessionFor(layer, set, get);
  },

  setLayer: (layer) => set({ layer, index: 0 }),

  advanceToLayer: (next) => {
    const state = get();
    // Close the previous layer's session with that layer's own counts so
    // analytics see one row per (layer, user) per flow — not a single
    // cross-layer roll-up under whichever layer we started on.
    if (state.sessionId) {
      const layerCounts = state.layerTotals;
      void completeReviewSession(state.sessionId, layerCounts).catch((e) => {
        if (__DEV__) console.warn("[review] completeReviewSession failed", e);
      });
    }
    set({
      layer: next,
      index: 0,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      layerTotals: EMPTY_COUNTS,
      // Cumulative `totals`, `mode`, and `srsByCard` are preserved across
      // layers — mode in particular MUST survive so an ensureSession() race
      // can't downgrade an in-progress flow to single.
    });
    openSessionFor(next, set, get);
  },

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
    const layerTotals: Counts = {
      remembered: state.layerTotals.remembered + (response === "remembered" ? 1 : 0),
      struggled: state.layerTotals.struggled + (response === "struggled" ? 1 : 0),
      forgot: state.layerTotals.forgot + (response === "forgot" ? 1 : 0),
      reviewed: state.layerTotals.reviewed + 1,
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
      // Only persist when we have a real memories row to point at. Static
      // demo decks would FK-violate; the persist guards are belt + braces
      // because demo mode also short-circuits inside the api layer.
      if (userId && isPersistableMemoryId(card.id)) {
        // applyScheduledUpdate doesn't need a session id — fire it now.
        void applyScheduledUpdate(card.id, updated).catch((e) => {
          if (__DEV__) console.warn("[review] applyScheduledUpdate failed for", card.id, e);
        });
        if (state.sessionId) {
          void recordReviewItem({
            sessionId: state.sessionId,
            memoryId: card.id,
            userId,
            response,
          }).catch((e) => {
            if (__DEV__) console.warn("[review] recordReviewItem failed for", card.id, e);
          });
        } else if (state.pendingSessionLayer === state.layer) {
          // Session id not back from the server yet — queue this answer to
          // be flushed once openSessionFor resolves. Avoids the items/
          // session-counter divergence Codex flagged.
          const reviewedAt = new Date().toISOString();
          set({
            pendingItems: [
              ...state.pendingItems,
              { memoryId: card.id, userId, response, reviewedAt },
            ],
          });
        }
      }
    }

    const nextIndex = state.index + 1;
    if (nextIndex < cards.length) {
      set({ index: nextIndex, totals, layerTotals });
      return "next";
    }

    // End of layer.
    set({ totals, layerTotals });
    if (state.mode === "flow" && (state.layer === "scan" || state.layer === "reinforcement")) {
      // Session close + new-session open is deferred to advanceToLayer(),
      // called by the handoff screen when the user picks the next layer.
      return "handoff";
    }
    // End of session (single layer mode, or end of focus in flow mode).
    if (state.sessionId) {
      const finalLayerCounts = layerTotals;
      void completeReviewSession(state.sessionId, finalLayerCounts).catch((e) => {
        if (__DEV__) console.warn("[review] completeReviewSession failed", e);
      });
    }
    return "done";
  },

  ensureSession: (layer, mode) => {
    const state = get();
    // Open OR pending session for this layer — flow handoff in progress.
    // Either way, do nothing: respect what advanceToLayer / start set up.
    if (state.layer === layer && (state.sessionId || state.pendingSessionLayer === layer)) {
      return;
    }
    // Genuine direct entry from Today — open a single-layer session.
    set({
      layer,
      mode,
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
    });
    openSessionFor(layer, set, get);
  },

  reset: () =>
    set({
      mode: "single",
      layer: "scan",
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      srsByCard: {},
    }),
}));
