import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { SectionLabel } from "@/components/SectionLabel";
import { RingChart, LegendDot } from "@/components/RingChart";
import { HealthRow } from "@/components/HealthRow";
import { CognitiveLoadBar } from "@/components/CognitiveLoadBar";
import { ErrorCard } from "@/components/ErrorCard";
import { MascotLoader } from "@/components/MascotLoader";
import { Tappable } from "@/components/Tappable";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { useFoldersWithStats } from "@/lib/use-folders";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { fetchDueCounts } from "@/lib/api";
import { reportError } from "@/lib/report-error";
import type { LayerCounts } from "@/lib/queue";
import type { FolderWithStats } from "@/lib/mappers";
import { FONT, colors } from "@/theme/tokens";

/** Carico cognitivo: 120 items ≈ tetto del budget 1h (spec core-loop §8). */
const LOAD_CEILING_ITEMS = 120;

export default function HealthScreen() {
  const user = useAuthStore((s) => s.user);
  const { folders, loading, error, refetch } = useFoldersWithStats();
  const order = useFolderOrderStore((s) => s.order);
  const orderedFolders = useMemo(
    () => applyFolderOrder(folders, order),
    [folders, order],
  );

  // Aggregato pesato sull'intera libreria: alimenta l'anello, la legenda e
  // il totale "ricordi monitorati". Solo numeri veri — in caricamento o in
  // errore l'anello NON viene disegnato (niente 62% di comodo).
  const agg = useMemo(() => {
    const count = folders.reduce((s, f) => s + f.count, 0);
    const w = (k: "active" | "fading" | "archived") =>
      count > 0
        ? Math.round(
            (folders.reduce((s, f) => s + (f.count * f[k]) / 100, 0) / count) * 100,
          )
        : 0;
    return { count, active: w("active"), fading: w("fading"), archived: w("archived") };
  }, [folders]);
  const foldersLoading = loading && folders.length === 0;

  // Insight onesto: la cartella col maggior numero assoluto di ricordi in
  // dissolvenza. Nessuna → niente card.
  const worst = useMemo(() => {
    let best: { f: FolderWithStats; fadingCount: number } | null = null;
    for (const f of folders) {
      const fadingCount = Math.round((f.count * f.fading) / 100);
      if (fadingCount > 0 && (!best || fadingCount > best.fadingCount)) {
        best = { f, fadingCount };
      }
    }
    return best;
  }, [folders]);

  // Carico cognitivo derivato dalla coda. Stato esplicito: finché il fetch
  // non risolve la barra non compare, e un errore mostra "Riprova".
  const [due, setDue] = useState<LayerCounts | null>(null);
  const [dueError, setDueError] = useState(false);
  const [dueLoading, setDueLoading] = useState(false);
  const dueSeq = useRef(0);
  const loadDue = useCallback(() => {
    if (!user) return;
    const myId = ++dueSeq.current;
    setDueLoading(true);
    setDueError(false);
    fetchDueCounts(user.id)
      .then((c) => {
        if (myId !== dueSeq.current) return;
        setDue(c);
        setDueLoading(false);
      })
      .catch((e) => {
        if (myId !== dueSeq.current) return;
        reportError("health/due-counts", e);
        setDueError(true);
        setDueLoading(false);
      });
  }, [user]);
  useFocusEffect(
    useCallback(() => {
      loadDue();
      return () => {
        dueSeq.current++;
      };
    }, [loadDue]),
  );
  const dueTotal = due ? due.scan + due.reinforcement + due.focus : null;
  const loadPct =
    dueTotal === null ? null : Math.min(100, Math.round((dueTotal / LOAD_CEILING_ITEMS) * 100));

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <HeaderHero title="Salute della memoria" reservedRight={108} />
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 2, right: 14 }}
          >
            <Mascot variant="investigate" size={92} withShadow={false} />
          </View>
        </View>

        {/* Hero — anello sul pannello navy SOLO con dati veri */}
        <View style={{ paddingHorizontal: 16 }}>
          {foldersLoading ? (
            <View style={{ paddingVertical: 36, alignItems: "center" }}>
              <MascotLoader label="Calcolo la salute della memoria…" />
            </View>
          ) : error ? (
            <ErrorCard
              title="Non siamo riusciti a caricare la salute della memoria."
              onRetry={refetch}
              retrying={loading}
              retryAccessibilityLabel="Riprova a caricare la salute della memoria"
            />
          ) : agg.count === 0 ? (
            <View
              className="rounded-card bg-surface"
              style={{
                padding: 18,
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 15,
                  color: colors.navy,
                  textAlign: "center",
                }}
              >
                Nessun ricordo ancora.
              </Text>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 13.5,
                  lineHeight: 19,
                  color: colors.midGrey,
                  textAlign: "center",
                }}
              >
                La salute della memoria si calcola sui ricordi che salvi e ripassi. Aggiungi il
                primo e torna qui.
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.navy,
                borderRadius: 18,
                paddingVertical: 24,
                paddingHorizontal: 20,
                overflow: "hidden",
              }}
            >
              <View style={{ alignItems: "center" }}>
                <RingChart
                  size={156}
                  centerValue={String(agg.active)}
                  centerLabel="Stabili"
                  segments={[
                    { color: colors.active, pct: agg.active },
                    { color: colors.fading, pct: agg.fading },
                    { color: colors.archived, pct: agg.archived },
                  ]}
                />
              </View>
              <Text
                style={{
                  textAlign: "center",
                  marginTop: 14,
                  fontFamily: FONT.medium,
                  fontSize: 14,
                  color: "rgba(250,248,244,0.82)",
                  letterSpacing: 0.52, // 0.04em on 13px (was 1.2 = too wide)
                  textTransform: "uppercase",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {agg.count} {agg.count === 1 ? "ricordo monitorato" : "ricordi monitorati"}
              </Text>
              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  rowGap: 8,
                  columnGap: 14,
                }}
              >
                <LegendDot color={colors.active} label="Stabili" pct={`${agg.active}%`} />
                <LegendDot color={colors.fading} label="In dissolvenza" pct={`${agg.fading}%`} />
                <LegendDot color={colors.archived} label="Archiviati" pct={`${agg.archived}%`} />
              </View>
            </View>
          )}
        </View>

        {/* Folder breakdown — dati veri dal rollup condiviso */}
        {!error && orderedFolders.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
              <SectionLabel>Per cartella</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              {orderedFolders.map((f) => (
                <HealthRow
                  key={f.kind}
                  name={f.name}
                  active={f.active}
                  fading={f.fading}
                  archived={f.archived}
                  chip={f.active >= 70 ? "Alta" : f.active >= 45 ? "Media" : "Bassa"}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Insight card — solo quando c'è davvero qualcosa da riequilibrare */}
        {worst ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
            <View
              className="rounded-card bg-surface"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                borderLeftWidth: 2.5,
                borderLeftColor: colors.reinforcement,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.medium,
                  fontSize: 15,
                  color: colors.navy,
                  lineHeight: 22,
                  letterSpacing: -0.05,
                }}
              >
                {worst.f.name} ha {worst.fadingCount}{" "}
                {worst.fadingCount === 1 ? "ricordo" : "ricordi"} in dissolvenza —
                una sessione mirata li può recuperare.
              </Text>
              <Tappable
                onPress={() =>
                  router.push({ pathname: "/folder/[kind]", params: { kind: worst.f.kind } })
                }
                accessibilityLabel={`Riequilibra ora, vai alla cartella ${worst.f.name}`}
                containerStyle={{ marginTop: 6, alignSelf: "flex-end" }}
                style={{ paddingVertical: 4 }}
              >
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 14.5,
                    color: colors.reinforcement,
                    letterSpacing: -0.05,
                  }}
                >
                  Riequilibra ora →
                </Text>
              </Tappable>
            </View>
          </View>
        ) : null}

        {/* Cognitive load — barra solo con la coda vera */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Carico cognitivo</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: dueError ? 16 : 24 }}>
          {loadPct !== null ? (
            <CognitiveLoadBar pct={loadPct} />
          ) : dueError ? (
            <ErrorCard
              title="Non siamo riusciti a calcolare il carico cognitivo."
              onRetry={loadDue}
              retrying={dueLoading}
              retryAccessibilityLabel="Riprova a calcolare il carico cognitivo"
            />
          ) : (
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 13.5,
                color: colors.midGrey,
                marginTop: 6,
              }}
            >
              Calcolo il carico cognitivo dalla coda di oggi…
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
