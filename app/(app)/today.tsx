import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { CalendarDays, ChevronRight, Clock } from "lucide-react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ErrorCard } from "@/components/ErrorCard";
import { Mascot } from "@/components/Mascot";
import { FolderTile } from "@/components/FolderTile";
import { Tappable } from "@/components/Tappable";
import { useAuthStore } from "@/lib/auth-store";
import { useReviewStore } from "@/lib/review-store";
import {
  fetchDueByFolder,
  fetchDueCounts,
  fetchOverdueCount,
  fetchUpcomingCounts,
} from "@/lib/api";
import { useFoldersWithStats } from "@/lib/use-folders";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { dayKeyOf, upcomingDays, type UpcomingDay } from "@/lib/upcoming";
import { reportError } from "@/lib/report-error";
import { isDemoMode } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import { DEMO_DUE_COUNTS, totalMinutes, type LayerCounts } from "@/lib/queue";
import { REVIEW_LAYERS } from "@/lib/constants";
import { firstName, dateBadge, timeGreeting } from "@/lib/format";
import { FONT, radii, useThemeTokens } from "@/theme/tokens";

/** Orizzonte della sezione "Prossimi ripassi" (il calendario copre oltre). */
const UPCOMING_HORIZON_DAYS = 30;

export default function TodayScreen() {
  const { t, tp } = useT();
  const { colors, layerTint } = useThemeTokens();
  const user = useAuthStore((s) => s.user);
  const display = firstName(user?.name ?? "", t("today.welcomeFallbackName"));
  const [dueCounts, setDueCounts] = useState<LayerCounts | null>(null);
  // Le sezioni del mockup di Maurizio (2026-09-01): ritardatari, per-cartella
  // e giorni futuri. Se falliscono non bloccano la card hero: la sezione
  // semplicemente non compare e l'errore viene riportato.
  const [overdue, setOverdue] = useState(0);
  const [dueByFolder, setDueByFolder] = useState<Map<string, number>>(() => new Map());
  const [upcoming, setUpcoming] = useState<UpcomingDay[]>([]);
  // Stato del fetch della coda: la schermata non deve mai restare su
  // "Sto preparando il piano…" con la CTA disabilitata per sempre — dopo
  // un errore (rete, timeout) mostra una card con "Riprova".
  const [dueError, setDueError] = useState(false);
  const [dueLoading, setDueLoading] = useState(false);
  // Sequenza monotona: solo l'ultima richiesta può scrivere lo stato, così
  // un retry veloce non viene sovrascritto da una risposta più lenta.
  const dueSeq = useRef(0);

  const { folders } = useFoldersWithStats();
  const order = useFolderOrderStore((s) => s.order);

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
    // Sezioni secondarie: non condizionano la CTA né lo stato di errore.
    fetchOverdueCount(user.id)
      .then((n) => {
        if (myId === dueSeq.current) setOverdue(n);
      })
      .catch((e) => reportError("today/overdue", e));
    fetchDueByFolder(user.id)
      .then((m) => {
        if (myId === dueSeq.current) setDueByFolder(m);
      })
      .catch((e) => reportError("today/due-by-folder", e));
    const from = new Date();
    const to = new Date(from.getTime() + UPCOMING_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    fetchUpcomingCounts(user.id, from.toISOString(), to.toISOString())
      .then((counts) => {
        if (myId === dueSeq.current) setUpcoming(upcomingDays(counts, 2));
      })
      .catch((e) => reportError("today/upcoming", e));
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

  // Il piano del giorno È la coda: tutto ciò che è in scadenza, per fase,
  // senza tetto (deciso il 4/9/2026 — il selettore "quanto tempo hai" non
  // esiste più, i minuti restano una stima e non una scelta). In demo i
  // conteggi sono quelli dei mazzi statici; in reale restano null ("…")
  // finché il fetch non risolve — mai numeri finti a un utente vero.
  const plan: LayerCounts | null = dueCounts ?? (isDemoMode ? DEMO_DUE_COUNTS : null);
  const totDue = plan ? plan.scan + plan.reinforcement + plan.focus : null;
  const totMin = plan ? totalMinutes(plan) : null;
  const showPlanError = dueError && !plan;
  const startSession = useReviewStore((s) => s.start);

  // Cartelle con carte in coda ADESSO, nell'ordine scelto dall'utente —
  // la sezione "Oggi" del mockup. Il vecchio sottotitolo "3 × 48h" non
  // esiste più per scelta esplicita (Maurizio 2026-09-01).
  const foldersDue = applyFolderOrder(
    folders.filter((f) => (dueByFolder.get(f.id) ?? 0) > 0),
    order,
  );

  // Initialize the review-store BEFORE navigating so the destination
  // screen's useFocusEffect sees the right mode/session.
  const startReview = () => {
    if (!plan) return;
    const first = REVIEW_LAYERS.find((l) => plan[l] > 0) ?? "scan";
    // layerCaps = la coda: lo store carica ogni fase per intero e l'handoff
    // salta le fasi vuote. Senza layerCaps ricadrebbe sul suo default di 28.
    startSession(first, "flow", { layerCaps: plan });
    router.push(`/review/${first}`);
  };

  const tomorrowKey = dayKeyOf(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const upcomingLabel = (dayKey: string) =>
    dayKey === tomorrowKey
      ? t("today.tomorrow")
      : dateBadge(new Date(`${dayKey}T12:00:00`));

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero with mascot peek. */}
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

        {/* Card hero "Ripassi di oggi" — mockup Maurizio 2026-09-01: numero
            nel cerchio a sinistra (al posto dei quadrati sovrapposti). */}
        <View style={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("today.reviewsToday")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          {showPlanError ? (
            <ErrorCard
              title={t("today.planErrorTitle")}
              onRetry={loadDueCounts}
              retrying={dueLoading}
              retryAccessibilityLabel={t("today.planRetryAccessibility")}
              style={{ alignSelf: "stretch" }}
            />
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.card,
                borderWidth: 1,
                borderColor: colors.hairline,
                padding: 16,
                gap: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: layerTint.focus,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT.bold,
                      fontSize: totDue !== null && totDue > 99 ? 18 : 22,
                      color: colors.navy,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {totDue ?? "…"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: FONT.bold,
                      fontSize: 17,
                      color: colors.navy,
                      letterSpacing: -0.2,
                    }}
                  >
                    {tp("today.heroLabel", totDue ?? 0)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.regular,
                      fontSize: 13.5,
                      color: colors.midGrey,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {plan
                      ? `${tp("today.heroFolders", foldersDue.length)} · ${t("today.approxMinutes", { minutes: totMin ?? 0 })}`
                      : t("today.preparingPlan")}
                  </Text>
                </View>
              </View>
              <PrimaryButton
                label={
                  plan && totDue === 0 ? t("today.nothingToReview") : t("today.startReviewHero")
                }
                onPress={startReview}
                disabled={!plan || totDue === 0}
              />
            </View>
          )}
        </View>

        {/* Da recuperare — solo se c'è qualcosa oltre la finestra. */}
        {overdue > 0 ? (
          <>
            <View style={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
              <SectionLabel>{t("today.recoverSection")}</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <Tappable
                accessibilityRole="button"
                accessibilityLabel={tp("today.overdue", overdue)}
                onPress={startReview}
                pressedOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: colors.surface,
                  borderRadius: radii.card,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.dangerSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock size={20} color={colors.danger} strokeWidth={2} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: FONT.semibold,
                    fontSize: 15.5,
                    color: colors.navy,
                  }}
                >
                  {tp("today.overdue", overdue)}
                </Text>
                <ChevronRight size={18} color={colors.midGrey} strokeWidth={2} />
              </Tappable>
            </View>
          </>
        ) : null}

        {/* Oggi — cartelle con carte in coda, in ordine di priorità. */}
        {foldersDue.length > 0 ? (
          <>
            <View
              style={{
                paddingHorizontal: 28,
                paddingTop: 24,
                paddingBottom: 8,
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <SectionLabel>{t("today.todaySection")}</SectionLabel>
              <Text
                style={{ fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey }}
              >
                {t("today.byPriority")}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {foldersDue.map((f) => (
                <Tappable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={f.name}
                  onPress={() =>
                    router.push({ pathname: "/folder/[id]", params: { id: f.id } })
                  }
                  pressedOpacity={0.85}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: colors.surface,
                    borderRadius: radii.card,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <FolderTile emoji={f.emoji} size={32} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontFamily: FONT.semibold,
                      fontSize: 15.5,
                      color: colors.navy,
                      letterSpacing: -0.15,
                    }}
                  >
                    {f.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.medium,
                      fontSize: 13.5,
                      color: colors.scan,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {tp("today.folderDue", dueByFolder.get(f.id) ?? 0)}
                  </Text>
                  <ChevronRight size={16} color={colors.midGrey} strokeWidth={2} />
                </Tappable>
              ))}
            </View>
          </>
        ) : null}

        {/* Prossimi ripassi — due giorni, poi "Vedi ripassi successivi". */}
        <View style={{ paddingHorizontal: 28, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("today.upcomingSection")}</SectionLabel>
        </View>
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: colors.hairline,
          }}
        >
          {upcoming.map((d, i) => (
            <Tappable
              key={d.dayKey}
              accessibilityRole="button"
              accessibilityLabel={`${upcomingLabel(d.dayKey)} · ${tp("upcoming.dayCount", d.count)}`}
              // La riga di un giorno apre direttamente il foglio di QUEL
              // giorno; solo "Vedi ripassi successivi" apre il calendario.
              // `open` cambia a ogni tocco: /upcoming e' un tab e resta montato, e con
              // il solo `day` un secondo tocco su "Domani" non riaprirebbe nulla.
              onPress={() => router.push({ pathname: "/upcoming", params: { day: d.dayKey, open: String(Date.now()) } } as never)}
              pressedOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairline,
              }}
            >
              <CalendarDays size={18} color={colors.scan} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: FONT.semibold,
                  fontSize: 14.5,
                  color: colors.navy,
                }}
              >
                {upcomingLabel(d.dayKey)}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.medium,
                  fontSize: 13.5,
                  color: colors.scan,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {tp("today.folderDue", d.count)}
              </Text>
              <ChevronRight size={16} color={colors.midGrey} strokeWidth={2} />
            </Tappable>
          ))}
          <Tappable
            accessibilityRole="button"
            accessibilityLabel={t("today.seeUpcoming")}
            // Parametri vuoti di proposito: il tab conserva quelli dell'ultimo
            // "Domani", e senza azzerarli il calendario riaprirebbe quel giorno.
            onPress={() => router.push({ pathname: "/upcoming", params: { day: "", open: "" } } as never)}
            pressedOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 13,
            }}
          >
            <CalendarDays size={18} color={colors.midGrey} strokeWidth={2} />
            <Text
              style={{
                flex: 1,
                fontFamily: FONT.semibold,
                fontSize: 14.5,
                color: colors.navy,
              }}
            >
              {t("today.seeUpcoming")}
            </Text>
            <ChevronRight size={16} color={colors.midGrey} strokeWidth={2} />
          </Tappable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
