import { create } from "zustand";
import type { LayerKey } from "@/theme/tokens";

import { useAuthStore } from "./auth-store";
import {
  applyScheduledUpdate,
  completeReviewSession,
  fetchDueMemoriesByLayer,
  fetchFolders,
  recordReviewItem,
  startReviewSession,
} from "./api";
import { isDemoMode } from "./supabase";
import { reportError } from "./report-error";
import { t } from "@/lib/i18n";
import { toReviewCard, type LayerCounts } from "./queue";
import { update as scheduleUpdate } from "@/features/srs/scheduler";
import {
  initialSrsState,
  type LayerOutcome,
  type SrsState,
  type UpdatedSrs,
} from "@/features/srs/types";
import { FOLDER_KINDS, type FolderKind, type ReviewResponse } from "./constants";

export type ReviewCard = {
  /** Stable id so persistence keeps SRS state per-card across reviews. */
  id: string;
  front: string;
  reading?: string;
  back: string;
  example?: string;
  /** Authored mnemonic cue for the Reinforcement hint stage — a memory hook, never an answer fragment. */
  hint?: string;
  folder: string;
  /** Folder kind slug — lets a folder-scoped session filter the deck. */
  folderKind?: FolderKind;
  /**
   * Persisted SRS snapshot mapped from the memories row. Demo cards omit it.
   * NOTE for the Phase 3D deck loader: SrsState also needs nextReviewAt and
   * lastReviewedAt, which sit OUTSIDE memory.srs on the mapped Memory —
   * build { ...memory.srs, nextReviewAt, lastReviewedAt }.
   */
  srs?: SrsState;
};

/**
 * Static demo decks (demo mode only). Text fields are getters so `card.back`,
 * `card.folder`, … resolve in the CURRENT language at access time — the
 * runtime language switch must apply to demo cards too, and a translated
 * string cached in a module constant would not. Target-language content
 * (kanji, readings, Latin, Spanish terms, Japanese example sentences) stays
 * literal. Card objects keep their identity so current() stays referentially
 * stable between renders.
 */
const SCAN_CARDS: ReviewCard[] = [
  {
    id: "demo-scan-0",
    front: "sendero",
    get back() { return t("reviewStore.demoScanSenderoBack"); },
    get folder() { return t("constants.templateEsName"); },
    folderKind: "es",
  },
  {
    id: "demo-scan-1",
    get front() { return t("folderData.medPruritusFront"); },
    get back() { return t("folderData.medPruritusBack"); },
    get folder() { return t("constants.templateMedicineName"); },
    folderKind: "medicine",
  },
  {
    id: "demo-scan-2",
    front: "難しい",
    reading: "muzukashii",
    get back() { return t("folderData.jpMuzukashiiBack"); },
    get folder() { return t("constants.templateJpName"); },
    folderKind: "jp",
  },
  {
    id: "demo-scan-3",
    front: "Caveat emptor",
    get back() { return t("folderData.lawCaveatEmptorBack"); },
    get folder() { return t("constants.templateLawName"); },
    folderKind: "law",
  },
];

const REINF_CARDS: ReviewCard[] = [
  {
    id: "demo-reinf-0",
    front: "amanecer",
    get back() { return t("folderData.esAmanecerBack"); },
    get hint() { return t("reviewStore.demoReinfAmanecerHint"); },
    get folder() { return t("constants.templateEsName"); },
    folderKind: "es",
  },
  {
    id: "demo-reinf-1",
    get front() { return t("folderData.medSynapseFront"); },
    get back() { return t("folderData.medSynapseBack"); },
    get hint() { return t("reviewStore.demoReinfSinapsiHint"); },
    get folder() { return t("constants.templateMedicineName"); },
    folderKind: "medicine",
  },
  {
    id: "demo-reinf-2",
    front: "希望",
    reading: "kibō",
    get back() { return t("folderData.jpKibouBack"); },
    get hint() { return t("reviewStore.demoReinfKibouHint"); },
    get folder() { return t("constants.templateJpName"); },
    folderKind: "jp",
  },
];

const FOCUS_CARDS: ReviewCard[] = [
  {
    id: "demo-focus-0",
    front: "中心",
    reading: "chūshin",
    get back() { return t("folderData.jpChushinBack"); },
    example: "Memika は学習の中心です",
    get folder() { return t("constants.templateJpName"); },
    folderKind: "jp",
  },
  {
    id: "demo-focus-1",
    front: "完璧",
    reading: "kanpeki",
    get back() { return t("folderData.jpKanpekiBack"); },
    example: "完璧な仕事です",
    get folder() { return t("constants.templateJpName"); },
    folderKind: "jp",
  },
  {
    id: "demo-focus-2",
    front: "Estoppel",
    get back() { return t("folderData.lawEstoppelBack"); },
    get example() { return t("reviewStore.demoFocusEstoppelExample"); },
    get folder() { return t("constants.templateLawName"); },
    folderKind: "law",
  },
];

const DECKS: Record<LayerKey, ReviewCard[]> = {
  scan: SCAN_CARDS,
  reinforcement: REINF_CARDS,
  focus: FOCUS_CARDS,
};

/** Unscoped deck size — single source of truth for Today's plan counts and the handoff preview. */
export const deckSizeFor = (layer: LayerKey): number => DECKS[layer].length;

/** Deck sizes keyed by layer, derived from the same decks the review screens run. */
export const DECK_SIZES: Record<LayerKey, number> = {
  scan: deckSizeFor("scan"),
  reinforcement: deckSizeFor("reinforcement"),
  focus: deckSizeFor("focus"),
};

/**
 * Deck for the current session — filtered to the active folder when the
 * session was started from a folder's "Ripassa ora". Used by cards(),
 * current() and recordAndAdvance so index/length stay consistent with what
 * the screen renders. Phase 3D: when decks come from fetchDueMemoriesByLayer
 * the folder scope must be passed through to the query (prefer folder_id
 * over kind — kind only covers the four seed folders).
 */
function deckFor(s: ReviewState): ReviewCard[] {
  const deck = DECKS[s.layer];
  return s.folderKind ? deck.filter((c) => c.folderKind === s.folderKind) : deck;
}

export type Counts = {
  remembered: number;
  struggled: number;
  forgot: number;
  reviewed: number;
};

/** Esito di una singola carta nella sessione corrente — letto dal recap. */
export type RecapEntry = {
  id: string;
  term: string;
  reading?: string;
  layer: LayerKey;
  response: "remembered" | "forgot";
  revealed: boolean;
};

const EMPTY_COUNTS: Counts = { remembered: 0, struggled: 0, forgot: 0, reviewed: 0 };

type PendingItem = {
  memoryId: string;
  userId: string;
  response: ReviewResponse;
  reviewedAt: string;
};

/**
 * Translate a screen response + the layer the card is currently on into the
 * LayerOutcome the scheduler understands. Answers are binary on every layer
 * (Maurizio, 2026-08-29: the intermediate "struggled" is out for now — it
 * comes back later with its own timing and only for item types where a
 * partial recall makes sense). Mapping per docs/SRS.md:
 *   scan:          remembered → remember (q=4),   forgot → show (q=2)
 *   reinforcement: remembered → continue (q=4),   forgot → again (q=1)
 *   focus:         remembered → remembered (q=5), forgot → forgot (q=0)
 */
function toLayerOutcome(layer: LayerKey, response: "remembered" | "forgot"): LayerOutcome {
  switch (layer) {
    case "scan":
      return { layer: "scan", outcome: response === "remembered" ? "remember" : "show" };
    case "reinforcement":
      return { layer: "reinforcement", outcome: response === "remembered" ? "continue" : "again" };
    case "focus":
      return { layer: "focus", outcome: response === "remembered" ? "remembered" : "forgot" };
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
  /** Folder scope for the session — null reviews every folder's cards. */
  folderKind: FolderKind | null;
  /** Folder scope come id DB — le sessioni da cartella lo passano a start(). */
  folderId: string | null;
  /** Mazzo vero caricato dal DB per il livello corrente. null = demo o non (ancora) caricato. */
  deck: ReviewCard[] | null;
  deckLoading: boolean;
  /**
   * L'ultimo caricamento del mazzo è fallito (rete, timeout, RLS). Le
   * schermate mostrano un errore con "Riprova" invece di trattare il mazzo
   * vuoto come "livello finito" e saltare a Complete con 0 carte.
   */
  deckError: boolean;
  /** Piano per livello (snapshot mostrato su Oggi) — advanceToLayer lo consulta. */
  layerCaps: LayerCounts | null;
  /** Tetto items complessivo della sessione (budget tempo). */
  budgetCap: number | null;
  /** Esiti per carta della sessione corrente — il recap li legge. */
  results: RecapEntry[];
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
  start: (
    layer: LayerKey,
    mode: "flow" | "single",
    opts?: {
      folderKind?: FolderKind;
      folderId?: string;
      budgetCap?: number;
      layerCaps?: LayerCounts;
    },
  ) => void;
  recordAndAdvance: (
    response: "remembered" | "forgot",
    opts?: { revealed?: boolean },
  ) => "next" | "handoff" | "done";
  /**
   * Corregge l'ultima risposta Scan in "forgot" entro la finestra del
   * flash di conferma. Ritorna false se la finestra è già chiusa.
   */
  amendLastAnswer: () => boolean;
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
  /** Ricarica il mazzo del livello corrente dopo un `deckError`. */
  retryDeckLoad: () => void;
};

/**
 * Monotonic id for in-flight startReviewSession requests. Lets the resolve
 * handler tell its own request apart from a newer one — without this, two
 * rapid start()/advanceToLayer() calls could either drop the newer session
 * id (if we naively check sessionId === null) or accept a stale one.
 */
let openSessionSeq = 0;

/** Last accepted answer timestamp — swallows double-taps before navigation unmounts the screen. */
let lastRecordAt = 0;

/** The newest in-flight session promise. Used to finalize an abandoned layer. */
let currentSessionPromise: Promise<{ id: string } | null> | null = null;

/** Durata del flash di conferma su Scan — finestra utile per l'amend. */
export const AMEND_WINDOW_MS = 1400;

/**
 * Persistenza Scan differita per la finestra di correzione del flash: la
 * risposta si scrive solo a finestra chiusa, così l'amend riscrive l'esito
 * giusto senza doppie righe da riconciliare.
 */
let pendingScanPersist: {
  timer: ReturnType<typeof setTimeout>;
  run: () => void;
} | null = null;

/** Ultima risposta Scan — bersaglio del possibile amend nel flash. */
let lastScanAnswer: {
  cardId: string;
  prior: SrsState;
  persist: (finalResponse: ReviewResponse, finalSrs: UpdatedSrs) => void;
} | null = null;

function clearPendingScanPersist(flush = true) {
  if (!pendingScanPersist) return;
  clearTimeout(pendingScanPersist.timer);
  const p = pendingScanPersist;
  pendingScanPersist = null;
  lastScanAnswer = null;
  if (flush) p.run();
}

/** Sequenza monotona per i load del mazzo — l'ultimo vince. */
let deckLoadSeq = 0;

/**
 * Carica il mazzo vero per `layer` da Supabase e lo mappa in ReviewCard.
 * Demo/anonimo: deck resta null e cards() usa i mazzi statici. Il tetto
 * viene dal piano per livello (layerCaps) o dal budget complessivo.
 */
async function loadDeckFor(
  layer: LayerKey,
  set: (partial: Partial<ReviewState>) => void,
  get: () => ReviewState,
): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (isDemoMode || !userId) {
    set({ deck: null, deckLoading: false, deckError: false });
    return;
  }
  const myId = ++deckLoadSeq;
  set({ deckLoading: true, deckError: false });
  try {
    const s = get();
    const cap = s.layerCaps?.[layer] ?? s.budgetCap ?? 28;
    if (cap <= 0) {
      if (myId === deckLoadSeq) set({ deck: [], deckLoading: false, deckError: false });
      return;
    }
    const [memories, folders] = await Promise.all([
      fetchDueMemoriesByLayer(userId, layer, {
        folderId: s.folderId ?? undefined,
        limit: cap,
      }),
      fetchFolders(userId),
    ]);
    if (myId !== deckLoadSeq) return;
    const nameById = new Map(folders.map((f) => [f.id, f.name]));
    const kindById = new Map(folders.map((f) => [f.id, f.kind]));
    set({
      deck: memories.map((m) => {
        const kind = kindById.get(m.folderId);
        return toReviewCard(
          m,
          nameById.get(m.folderId) ?? t("reviewStore.fallbackFolderName"),
          (FOLDER_KINDS as readonly string[]).includes(kind ?? "")
            ? (kind as FolderKind)
            : undefined,
        );
      }),
      deckLoading: false,
      deckError: false,
    });
  } catch (e) {
    // deck stays null (not []) so nothing downstream reads "empty layer";
    // deckError is what the screens branch on.
    if (myId === deckLoadSeq) set({ deck: null, deckLoading: false, deckError: true });
    reportError("review/deck-load", e, { layer });
  }
}

/** Mazzo attivo: quello vero se caricato, statici SOLO in demo mode. */
function activeDeck(s: ReviewState): ReviewCard[] {
  if (s.deck) return s.deck;
  return isDemoMode ? deckFor(s) : [];
}

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
      reportError("review/backfill-record-item", e, { sessionId });
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
              reportError("review/late-complete-session", e, { sessionId: session.id });
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
      reportError("review/start-session", e, { layer });
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
        reportError("review/stale-complete-session", e, { sessionId: session.id });
      });
    }
  });
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  mode: "single",
  layer: "scan",
  folderKind: null,
  folderId: null,
  deck: null,
  deckLoading: false,
  deckError: false,
  layerCaps: null,
  budgetCap: null,
  results: [],
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
  start: (layer, mode, opts = {}) => {
    lastRecordAt = 0;
    clearPendingScanPersist();
    set({
      layer,
      mode,
      folderKind: opts.folderKind ?? null,
      folderId: opts.folderId ?? null,
      budgetCap: opts.budgetCap ?? null,
      // Il piano fluido esegue lo snapshot mostrato su Oggi — niente refetch
      // interno che una sessione più vecchia potrebbe sovrascrivere.
      layerCaps: opts.layerCaps ?? null,
      deck: null,
      deckLoading: !isDemoMode,
      deckError: false,
      results: [],
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      pendingSessionComplete: null,
    });
    openSessionFor(layer, set, get);
    void loadDeckFor(layer, set, get);
  },

  setLayer: (layer) => set({ layer, index: 0 }),

  advanceToLayer: (next) => {
    lastRecordAt = 0;
    // Flush della risposta Scan ancora nella finestra flash: il bersaglio di
    // sessione è catturato nella closure, quindi scrive sulla riga giusta.
    clearPendingScanPersist();
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
        reportError("review/complete-session", e, { sessionId: state.sessionId, layer: state.layer });
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
      folderKind: null,
      deck: null,
      deckLoading: !isDemoMode,
      deckError: false,
      index: 0,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      pendingSessionComplete: null,
      layerTotals: EMPTY_COUNTS,
      // Cumulative `totals`, `mode`, `srsByCard`, `results`, `layerCaps` and
      // `budgetCap` are preserved across layers — mode in particular MUST
      // survive so an ensureSession() race can't downgrade an in-progress
      // flow to single, and results/caps feed the final recap + next decks.
    });
    openSessionFor(next, set, get);
    void loadDeckFor(next, set, get);
  },

  cards: () => activeDeck(get()),
  current: () => activeDeck(get())[get().index],

  recordAndAdvance: (response, opts = {}) => {
    const state = get();
    const cards = activeDeck(state);
    const card = cards[state.index];
    // Re-entry guards: a tap landing after the deck is finished, or within
    // the double-tap window, must not re-record. "next" is a no-op for all
    // three review screens (they only navigate on "handoff"/"done", which
    // the first tap already returned).
    if (!card) return "next";
    const now = Date.now();
    if (now - lastRecordAt < 250) return "next";
    lastRecordAt = now;
    // `struggled` stays in Counts because review_sessions.items_struggled is
    // a DB column; no screen produces it any more, so it is carried as-is.
    const totals: Counts = {
      remembered: state.totals.remembered + (response === "remembered" ? 1 : 0),
      struggled: state.totals.struggled,
      forgot: state.totals.forgot + (response === "forgot" ? 1 : 0),
      reviewed: state.totals.reviewed + 1,
    };
    const layerTotals: Counts = {
      remembered: state.layerTotals.remembered + (response === "remembered" ? 1 : 0),
      struggled: state.layerTotals.struggled,
      forgot: state.layerTotals.forgot + (response === "forgot" ? 1 : 0),
      reviewed: state.layerTotals.reviewed + 1,
    };

    // Run the scheduler + persist asynchronously. This is a side-effect we
    // intentionally fire-and-forget — the UI advances on the synchronous
    // setState below and the persistence completes in the background. Any
    // failure is logged in __DEV__; production telemetry comes in Phase 4.
    const userId = useAuthStore.getState().user?.id;
    const prior = state.srsByCard[card.id] ?? card.srs ?? initialSrsState();
    const updated = scheduleUpdate(prior, toLayerOutcome(state.layer, response));
    const entry: RecapEntry = {
      id: card.id,
      term: card.front,
      reading: card.reading,
      layer: state.layer,
      response,
      revealed: opts.revealed ?? false,
    };
    set({
      srsByCard: { ...state.srsByCard, [card.id]: updated },
      results: [...state.results, entry],
    });
    // Only persist when we have a real memories row to point at. Static
    // demo decks would FK-violate; the persist guards are belt + braces
    // because demo mode also short-circuits inside the api layer.
    // Bersaglio di sessione catturato ORA, non al fire del timer del flash:
    // advanceToLayer/reset possono ripulire lo store prima che la finestra
    // di correzione scada, e la scrittura deve restare attribuita alla
    // sessione in cui la risposta è avvenuta.
    const canPersist = !!userId && isPersistableMemoryId(card.id);
    const targetSessionId = state.sessionId;
    const targetSessionPromise = currentSessionPromise;
    const persist = (finalResponse: ReviewResponse, finalSrs: UpdatedSrs) => {
      if (!canPersist || !userId) return;
      void applyScheduledUpdate(card.id, finalSrs).catch((e) => {
        reportError("review/apply-scheduled-update", e, { cardId: card.id });
      });
      const write = (sid: string) =>
        void recordReviewItem({
          sessionId: sid,
          memoryId: card.id,
          userId,
          response: finalResponse,
        }).catch((e) => {
          reportError("review/record-item", e, { cardId: card.id, sessionId: sid });
        });
      if (targetSessionId) write(targetSessionId);
      else if (targetSessionPromise) {
        // Session id non ancora arrivato: incatena la scrittura alla promise
        // catturata — arriva sulla sessione giusta anche se abbandonata.
        void targetSessionPromise.then((session) => {
          if (session) write(session.id);
        });
      }
    };
    if (state.layer === "scan") {
      // Scan: persistenza differita per la finestra del flash, così un
      // eventuale amend riscrive l'esito corretto in un colpo solo. Vale
      // anche per le carte demo (persist è no-op ma l'amend dei contatori
      // locali deve funzionare pure offline).
      clearPendingScanPersist();
      lastScanAnswer = { cardId: card.id, prior, persist };
      pendingScanPersist = {
        timer: setTimeout(() => {
          pendingScanPersist = null;
          lastScanAnswer = null;
          persist(response, updated);
        }, AMEND_WINDOW_MS),
        run: () => persist(response, updated),
      };
    } else {
      persist(response, updated);
    }

    const nextIndex = state.index + 1;
    if (nextIndex < cards.length) {
      set({ index: nextIndex, totals, layerTotals });
      return "next";
    }

    // End of layer. Advance the index past the deck so any straggler tap
    // hits the !card guard above instead of re-recording the last card.
    set({ index: nextIndex, totals, layerTotals });
    if (state.mode === "flow" && (state.layer === "scan" || state.layer === "reinforcement")) {
      // Session close + new-session open is deferred to advanceToLayer(),
      // called by the handoff screen when the user picks the next layer.
      return "handoff";
    }
    // End of session (single layer mode, or end of focus in flow mode).
    const finalLayerCounts = layerTotals;
    if (state.sessionId) {
      void completeReviewSession(state.sessionId, finalLayerCounts).catch((e) => {
        reportError("review/complete-session", e, { sessionId: state.sessionId, layer: state.layer });
      });
    } else if (state.pendingSessionLayer === state.layer) {
      // Session id still in flight — defer completion. openSessionFor
      // resolves and reads this back to write completed_at + counters
      // without leaving an open review_sessions row behind.
      set({ pendingSessionComplete: finalLayerCounts });
    }
    return "done";
  },

  amendLastAnswer: () => {
    if (!pendingScanPersist || !lastScanAnswer) return false;
    clearTimeout(pendingScanPersist.timer);
    pendingScanPersist = null;
    const { cardId, prior, persist } = lastScanAnswer;
    lastScanAnswer = null;
    const s = get();
    const corrected = scheduleUpdate(prior, toLayerOutcome("scan", "forgot"));
    // remembered → forgot: sposta i contatori e correggi l'ultima entry.
    const fix = (c: Counts): Counts => ({
      ...c,
      remembered: c.remembered - 1,
      forgot: c.forgot + 1,
    });
    const results = s.results.slice();
    const last = results[results.length - 1];
    if (last && last.id === cardId) {
      results[results.length - 1] = { ...last, response: "forgot" };
    }
    set({
      totals: fix(s.totals),
      layerTotals: fix(s.layerTotals),
      srsByCard: { ...s.srsByCard, [cardId]: corrected },
      results,
    });
    // Stessa closure della risposta originale: stesso bersaglio di sessione,
    // outcome corretto.
    persist("forgot", corrected);
    return true;
  },

  ensureSession: (layer, mode) => {
    const state = get();
    // Open OR pending session for this layer — flow handoff in progress.
    // Either way, do nothing: respect what advanceToLayer / start set up.
    if (state.layer === layer && (state.sessionId || state.pendingSessionLayer === layer)) {
      return;
    }
    // Genuine direct entry from Today — open a single-layer session.
    clearPendingScanPersist();
    set({
      layer,
      mode,
      folderKind: null,
      folderId: null,
      budgetCap: null,
      layerCaps: null,
      deck: null,
      deckLoading: !isDemoMode,
      deckError: false,
      results: [],
      index: 0,
      totals: EMPTY_COUNTS,
      layerTotals: EMPTY_COUNTS,
      sessionId: null,
      pendingSessionLayer: null,
      pendingItems: [],
      pendingSessionComplete: null,
    });
    openSessionFor(layer, set, get);
    void loadDeckFor(layer, set, get);
  },

  retryDeckLoad: () => {
    const s = get();
    if (s.deckLoading) return;
    void loadDeckFor(s.layer, set, get);
  },

  reset: () => {
    // Flush di un'eventuale risposta Scan ancora nella finestra flash — la
    // closure ha già catturato il bersaglio di sessione giusto.
    clearPendingScanPersist();
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
      folderKind: null,
      folderId: null,
      deck: null,
      deckLoading: false,
      deckError: false,
      layerCaps: null,
      budgetCap: null,
      results: [],
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
