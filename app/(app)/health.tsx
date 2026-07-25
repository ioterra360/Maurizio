import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { SectionLabel } from "@/components/SectionLabel";
import { RingChart, LegendDot } from "@/components/RingChart";
import { HealthRow } from "@/components/HealthRow";
import { CognitiveLoadBar } from "@/components/CognitiveLoadBar";
import { Tappable } from "@/components/Tappable";
import { Mascot } from "@/components/Mascot";
import { useAuthStore } from "@/lib/auth-store";
import { useFoldersWithStats } from "@/lib/use-folders";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { fetchDueCounts } from "@/lib/api";
import type { LayerCounts } from "@/lib/queue";
import type { FolderWithStats } from "@/lib/mappers";
import { FONT, colors } from "@/theme/tokens";

export default function HealthScreen() {
  const user = useAuthStore((s) => s.user);
  const { folders, loading } = useFoldersWithStats();
  const order = useFolderOrderStore((s) => s.order);
  const orderedFolders = useMemo(
    () => applyFolderOrder(folders, order),
    [folders, order],
  );

  // Aggregato pesato sull'intera libreria: alimenta l'anello, la legenda e
  // il totale "ricordi monitorati" (prima erano numeri scritti a mano).
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
  // Durante il primo caricamento manteniamo i placeholder storici — mai NaN.
  const ring = loading && folders.length === 0
    ? { count: 779, active: 62, fading: 24, archived: 14 }
    : agg;

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

  // Carico cognitivo derivato dalla coda: 120 items ≈ tetto del budget 1h.
  // Euristica dichiarata (spec core-loop §8), da tarare con la telemetria.
  const [due, setDue] = useState<LayerCounts | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      fetchDueCounts(user.id)
        .then((c) => {
          if (!cancelled) setDue(c);
        })
        .catch((e) => {
          if (__DEV__) console.warn("[health] due counts failed", e);
        });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );
  const dueTotal = due ? due.scan + due.reinforcement + due.focus : null;
  const loadPct = dueTotal === null ? 62 : Math.min(100, Math.round((dueTotal / 120) * 100));

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

        {/* Hero ring on navy panel */}
        <View style={{ paddingHorizontal: 16 }}>
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
                centerValue={String(ring.active)}
                centerLabel="Stabili"
                segments={[
                  { color: colors.active, pct: ring.active },
                  { color: colors.fading, pct: ring.fading },
                  { color: colors.archived, pct: ring.archived },
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
              {ring.count} ricordi monitorati
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
              <LegendDot color={colors.active} label="Stabili" pct={`${ring.active}%`} />
              <LegendDot color={colors.fading} label="In dissolvenza" pct={`${ring.fading}%`} />
              <LegendDot color={colors.archived} label="Archiviati" pct={`${ring.archived}%`} />
            </View>
          </View>
        </View>

        {/* Folder breakdown — dati veri dal rollup condiviso */}
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

        {/* Cognitive load */}
        <View style={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Carico cognitivo</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <CognitiveLoadBar pct={loadPct} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
