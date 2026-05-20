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
  /**
   * Set when recordAndAdvance finishes a layer before the session id arrived.
   * openSessionFor flushes it once the id is in hand. Without this the
   * review_sessions row would stay open with completed_at == NULL even
   * though the user already finished the layer.
   */
  pendingSessionComplete: Counts | null;
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

/** The newest in-flight session promise. Used to finalize an abandoned layer. */
let currentSessionPromise: Promise<{ id: string } | null> | null = null;

/**
 * Fire-and-forget record of every queued answer against the now-known
 * session id. Exported as a helper because both the normal "session id
 * just arrived" path and the layer-handoff finalizer use it.
 */
function flushPendingItems(sessionId: string, items: PendingItem[]) {
  for (const p of items) {
    void recordReviewItem({
      sessionId,
      memoryId: p.memoryId,
      userId: p.userId,
      response: p.response,
      reviewedAt: p.reviewedAt,
    }).catch((e) => {
      if (__DEV__) console.warn("[review] backfill recordReviewItem failed", e);
    });
  }
}

/**
 * Open a new review_sessions row for `layer` and tag the store with its id.
 * Returns the promise so callers (advanceToLayer / reset) can chain a
 * finalize step onto the previous layer's request if it was still in flight.
 *
 * While the request is in flight we flag `pendingSessionLayer` so
 * ensureSession() can tell the difference between "no session yet because
 * nobody asked" and "no session yet because the handoff hasn't resolved".
 * A superseded response (newer start/advance/ensure ran in the meantime)
 * is dropped without touching live state — but the returned promise still
 * resolves with the session id, so finalizers can drain queued items into
 * the abandoned session.
 */
function openSessionFor(
  layer: LayerKey,
  set: (partial: Partial<ReviewState>) => void,
  get: () => ReviewState,
): Promise<{ id: string } | null> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    currentSessionPromise = Promise.resolve(null);
    return currentSessionPromise;
  }
  const myId = ++openSessionSeq;
  set({ pendingSessionLayer: layer });
  const p = startReviewSession(userId, layer)
    .then((session) => {
      // Live-state update only when we're still the winning request.
      if (myId === openSessionSeq) {
        const s = get();
        if (s.layer === layer) {
          const pending = s.pendingItems;
          set({
            sessionId: session.id,
            pendingSessionLayer: null,
            pendingItems: [],
          });
          flushPendingItems(session.id, pending);
          // If the layer was fully answered before the id arrived, close
          // it out now with the locally-known counts.
          if (s.pendingSessionComplete) {
            const counts = s.pendingSessionComplete;
            set({ pendingSessionComplete: null });
            void completeReviewSession(session.id, counts).catch((e) => {
              if (__DEV__) console.warn("[review] late completeReviewSession failed", e);
            });
          }
        } else {
          set({ pendingSessionLayer: null });
        }
      }
      return { id: session.id };
    })
    .catch((e) => {
      if (myId === openSessionSeq) set({ pendingSessionLayer: null });
      if (__DEV__) console.warn("[review] startReviewSession failed", e);
      return null;
    });
  currentSessionPromise = p;
  return p;
}

/**
 * Finalize a layer whose session id is still in flight at the moment the
 * user transitions away (advanceToLayer / reset). We can't block the UI,
 * but we can chain the drain/complete onto the in-flight promise so the
 * abandoned session lands consistent rows once the network catches up.
 */
function finalizeStaleSession(
  oldPromise: Promise<{ id: string } | null> | null,
  items: PendingItem[],
  counts: Counts | null,
) {
  if (!oldPromise) return;
  if (items.length === 0 && !counts) return;
  void oldPromise.then((session) => {
    if (!session) return;
    if (items.length > 0) flushPendingItems(session.id, items);
    if (counts) {
      void completeReviewSession(session.id, counts).catch((e) => {
        if (__DEV__) console.warn("[review] stale completeReviewSession failed", e);
      });
    }
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
  pendingSessionComplete: null,
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
      pendingSessionComplete: null,
    });
    openSessionFor(layer, set, get);
  },

  setLayer: (layer) => set({ layer, index: 0 }),

  advanceToLayer: (next) => {
    const state = get();
    const layerCounts = state.layerTotals;
    // Close the previous layer's session with that layer's own counts so
    // analytics see one row per (layer, user) per flow — not a single
    // cross-layer roll-up under whichever layer we started on.
    if (state.sessionId) {
      // Session id already known — flush any queued items (rare here, items
      // queue only when sessionId was null) and complete now.
      flushPendingItems(state.sessionId, state.pendingItems);
      void completeReviewSession(state.sessionId, layerCounts).catch((e) => {
        if (__DEV__) console.warn("[review] completeReviewSession failed", e);
      });
    } else {
      // Session id still in flight — chain the drain + complete onto the
      // OLD layer's promise so the abandoned session lands consistent rows
      // once the network catches up. We must do this BEFORE openSessionFor
      // for `next` bumps openSessionSeq.
      finalizeStaleSession(currentSessionPromise, state.pendingItems, layerCounts);
    }
    set({
      layer: next,
      index: 0,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      pendingSessionComplete: null,
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
    const finalLayerCounts = layerTotals;
    if (state.sessionId) {
      void completeReviewSession(state.sessionId, finalLayerCounts).catch((e) => {
        if (__DEV__) console.warn("[review] completeReviewSession failed", e);
      });
    } else if (state.pendingSessionLayer === state.layer) {
      // Session id still in flight — defer completion. openSessionFor
      // resolves and reads this back to write completed_at + counters
      // without leaving an open review_sessions row behind.
      set({ pendingSessionComplete: finalLayerCounts });
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
      pendingSessionComplete: null,
    });
    openSessionFor(layer, set, get);
  },

  reset: () => {
    // Finalize whatever's in flight before we wipe — same chain trick as
    // advanceToLayer so a "Back to Today" tap before the session id arrives
    // doesn't leave an open row.
    const state = get();
    if (!state.sessionId && currentSessionPromise) {
      const counts = state.pendingSessionComplete ?? state.layerTotals;
      const hasContent = state.pendingItems.length > 0 || counts.reviewed > 0;
      if (hasContent) finalizeStaleSession(currentSessionPromise, state.pendingItems, counts);
    }
    set({
      mode: "single",
      layer: "scan",
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      pendingSessionComplete: null,
      srsByCard: {},
    });
  },
}));
