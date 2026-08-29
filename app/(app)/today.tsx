import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { TimeBudgetChips } from "@/components/TimeBudgetChips";
import { SectionLabel } from "@/components/SectionLabel";
import { LayerCard } from "@/components/LayerCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ErrorCard } from "@/components/ErrorCard";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { useReviewStore } from "@/lib/review-store";
import { fetchDueCounts } from "@/lib/api";
import { reportError } from "@/lib/report-error";
import { isDemoMode } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import {
  DEMO_DUE_COUNTS,
  layerMinutes,
  splitBudget,
  totalMinutes,
  type LayerCounts,
} from "@/lib/queue";
import { REVIEW_LAYERS, TIME_BUDGETS } from "@/lib/constants";
import { firstName, dateBadge, timeGreeting } from "@/lib/format";
import { FONT, colors } from "@/theme/tokens";

/** Chiave AsyncStorage del budget scelto — la proposta del giorno sopravvive al riavvio. */
const BUDGET_KEY = "memika.time-budget-minutes";

export default function TodayScreen() {
  const { t, tp } = useT();
  const user = useAuthStore((s) => s.user);
  const display = firstName(user?.name ?? "", t("today.welcomeFallbackName"));
  const [budget, setBudget] = useState(15);
  const [dueCounts, setDueCounts] = useState<LayerCounts | null>(null);
  // Stato del fetch della coda: la schermata non deve mai restare su
  // "Sto preparando il piano…" con la CTA disabilitata per sempre — dopo
  // un errore (rete, timeout) mostra una card con "Riprova".
  const [dueError, setDueError] = useState(false);
  const [dueLoading, setDueLoading] = useState(false);
  // Sequenza monotona: solo l'ultima richiesta può scrivere lo stato, così
  // un retry veloce non viene sovrascritto da una risposta più lenta.
  const dueSeq = useRef(0);

  // Budget persistito: la scelta sopravvive al riavvio dell'app.
  useEffect(() => {
    AsyncStorage.getItem(BUDGET_KEY)
      .then((v) => {
        const n = v ? Number(v) : NaN;
        if (TIME_BUDGETS.some((b) => b.minutes === n)) setBudget(n);
      })
      .catch(() => {});
  }, []);
  const pickBudget = (minutes: number) => {
    setBudget(minutes);
    AsyncStorage.setItem(BUDGET_KEY, String(minutes)).catch(() => {});
  };

  // Conteggi veri della coda — aggiornati a ogni focus e su "Riprova".
  const loadDueCounts = useCallback(() => {
    if (!user) return;
    const myId = ++dueSeq.current;
    setDueLoading(true);
    setDueError(false);
    fetchDueCounts(user.id)
      .then((c) => {
        if (myId !== dueSeq.current) return;
        setDueCounts(c);
        setDueLoading(false);
      })
      .catch((e) => {
        if (myId !== dueSeq.current) return;
        reportError("today/due-counts", e);
        setDueError(true);
        setDueLoading(false);
      });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadDueCounts();
      return () => {
        // Invalida la richiesta in volo: al prossimo focus se ne apre una nuova.
        dueSeq.current++;
      };
    }, [loadDueCounts]),
  );

  // Recompute date label each render so a day rollover during a long session
  // doesn't leave a stale "MON · MAY 18" header.
  const greeting = timeGreeting();
  const dateLabel = dateBadge();
  // Hero sizing by screen width. adjustsFontSizeToFit does not shrink on
  // Android, so a 32 pt greeting next to the mascot broke mid-word on 360 dp
  // phones ("Buon pome / riggio"). Keep the widest greeting on one line.
  const { width: screenW } = useWindowDimensions();
  const hero =
    screenW < 340
      ? { fontSize: 24, lineHeight: 31, paddingRight: 96, mascot: 96 }
      : screenW < 390
        ? { fontSize: 27, lineHeight: 35, paddingRight: 100, mascot: 108 }
        : { fontSize: 32, lineHeight: 42, paddingRight: 128, mascot: 136 };

  // Piano del giorno derivato: coda vera × budget scelto. In demo i conteggi
  // sono quelli dei mazzi statici; in reale restano null ("…") finché il
  // fetch non risolve — mai numeri finti a un utente vero.
  const estItems = TIME_BUDGETS.find((b) => b.minutes === budget)?.estItems ?? 28;
  const counts = dueCounts ?? (isDemoMode ? DEMO_DUE_COUNTS : null);
  const plan = counts ? splitBudget(counts, estItems) : null;
  const totItems = plan ? plan.scan + plan.reinforcement + plan.focus : null;
  const totMin = plan ? totalMinutes(plan) : null;
  // Errore senza nessun conteggio (nemmeno uno precedente): stato di errore
  // al posto della CTA. Con conteggi stale dal focus precedente il piano
  // resta visibile e il refetch fallito è solo riportato.
  const showPlanError = dueError && !plan;
  const minutesLabel = (l: "scan" | "reinforcement" | "focus") =>
    plan ? t("today.approxMinutes", { minutes: layerMinutes(l, plan[l]) }) : "…";
  // Recommended flow subtitle pulled out so we can localize cleanly.
  const PLAN_LABELS = {
    scan:          t("today.scanSubtitle", { minutes: minutesLabel("scan") }),
    reinforcement: t("today.reinforcementSubtitle", { minutes: minutesLabel("reinforcement") }),
    focus:         t("today.focusSubtitle", { minutes: minutesLabel("focus") }),
  } as const;
  const startSession = useReviewStore((s) => s.start);

  // Initialize the review-store BEFORE navigating so the destination
  // screen's useFocusEffect sees the right mode/session. Skipping this
  // step let a same-layer pending request from an abandoned flow
  // suppress the new direct-entry session (Codex P2 on 6b777ad).
  const startReview = () => {
    if (!plan) return;
    // Il flusso esegue ESATTAMENTE il piano mostrato: snapshot dei caps,
    // niente refetch interno sovrascrivibile da sessioni più vecchie.
    // Parte dal primo livello con carte: con la regola dei layer (Focus =
    // ricordi nuovi) un utente ai primi giorni ha Scan e Reinforcement
    // vuoti, e aprirli creerebbe una review_sessions fantasma più un
    // "Scan completato" senza aver visto una carta.
    const first = REVIEW_LAYERS.find((l) => plan[l] > 0) ?? "scan";
    startSession(first, "flow", { budgetCap: estItems, layerCaps: plan });
    router.push(`/review/${first}`);
  };
  const startLayer = (path: "scan" | "reinforcement" | "focus") => {
    // Livello singolo = tutto il budget su quel livello, per scelta di spec.
    startSession(path, "single", { budgetCap: estItems });
    router.push(`/review/${path}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero with mascot peek — mascot is absolutely positioned
            so the 32pt heading keeps the full width on narrow phones (e.g.
            iPhone SE) rather than wrapping prematurely. */}
        <View style={{ paddingHorizontal: 28, paddingTop: 22, position: "relative" }}>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            numberOfLines={2}
            style={{
              fontFamily: FONT.bold,
              fontSize: hero.fontSize,
              color: colors.navy,
              lineHeight: hero.lineHeight,
              letterSpacing: -1,
              paddingBottom: 2,
              paddingRight: hero.paddingRight,
            }}
          >
            {greeting}
            {"\n"}
            {display}
          </Text>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 12.5,
              color: colors.midGrey,
              letterSpacing: 1.68,
              marginTop: 12,
            }}
          >
            {dateLabel}
          </Text>
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: -4, right: 4 }}
          >
            <Mascot variant="idea" size={hero.mascot} withShadow={false} />
          </View>
        </View>

        {/* Time budget chips */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <TimeBudgetChips value={budget} onChange={pickBudget} />
        </View>

        {/* Recommended flow */}
        <View style={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 8 }}>
          <SectionLabel>{t("today.recommendedFlow")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <LayerCard
            layerKey="scan"
            items={plan?.scan ?? 0}
            subtitle={PLAN_LABELS.scan}
            onPress={() => startLayer("scan")}
          />
          <LayerCard
            layerKey="reinforcement"
            items={plan?.reinforcement ?? 0}
            subtitle={PLAN_LABELS.reinforcement}
            onPress={() => startLayer("reinforcement")}
          />
          <LayerCard
            layerKey="focus"
            items={plan?.focus ?? 0}
            subtitle={PLAN_LABELS.focus}
            onPress={() => startLayer("focus")}
          />
        </View>

        {/* CTA — in normal flow at the bottom of the page (no floating layer),
            so it can never overlap the Focus card or anything else. */}
        <View style={{ paddingHorizontal: 20, marginTop: 28, alignItems: "center", gap: 12 }}>
          {showPlanError ? (
            <ErrorCard
              title={t("today.planErrorTitle")}
              onRetry={loadDueCounts}
              retrying={dueLoading}
              retryAccessibilityLabel={t("today.planRetryAccessibility")}
              style={{ alignSelf: "stretch" }}
            />
          ) : (
            <>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: FONT.regular,
                  fontSize: 13.5,
                  color: colors.midGrey,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {plan
                  ? tp("today.planTotal", totItems ?? 0, { minutes: totMin ?? 0 })
                  : t("today.preparingPlan")}
              </Text>
              <PrimaryButton
                label={plan && totItems === 0 ? t("today.nothingToReview") : t("today.startReview")}
                onPress={startReview}
                disabled={!plan || totItems === 0}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
