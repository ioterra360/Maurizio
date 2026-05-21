import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Repeat } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { FolderTopBar } from "@/components/FolderTopBar";
import { RetentionBar } from "@/components/RetentionBar";
import { StatBlock } from "@/components/StatBlock";
import { ActionPill } from "@/components/ActionPill";
import { FilterChip } from "@/components/FilterChip";
import { ItemRow } from "@/components/ItemRow";
import { SectionLabel } from "@/components/SectionLabel";
import { FONT, colors } from "@/theme/tokens";
import { CoachTip } from "@/components/CoachTip";
import { FOLDER_KINDS, type FolderKind, type MemoryState } from "@/lib/constants";
import { useFolderDetail } from "@/lib/use-folders";
import { useReviewStore } from "@/lib/review-store";
import { relativeReviewed } from "@/lib/format";
import { pickCategoryTip } from "@/lib/coach-tips";
import type { FolderItem } from "@/lib/folder-data";

export default function FolderDetailScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : null;
  const { folder, items, loading, error, refetch } = useFolderDetail(kind);
  const startSession = useReviewStore((s) => s.start);
  const [filter, setFilter] = useState<"all" | MemoryState>("all");

  // Memory (api/db model) → FolderItem (UI/display model) adapter. Kept
  // inline so we can rip it out when ItemRow accepts Memory directly.
  const displayItems = useMemo<FolderItem[]>(
    () =>
      items.map((m) => ({
        front: m.term,
        reading: m.reading ?? undefined,
        back: m.definition,
        state: m.state,
        reviewed: relativeReviewed(m.lastReviewedAt),
      })),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return displayItems;
    return displayItems.filter((i) => i.state === filter);
  }, [filter, displayItems]);

  const counts = useMemo(
    () => ({
      all: displayItems.length,
      active: displayItems.filter((i) => i.state === "active").length,
      fading: displayItems.filter((i) => i.state === "fading").length,
      archived: displayItems.filter((i) => i.state === "archived").length,
    }),
    [displayItems],
  );

  if (!kind) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar />
        <View style={{ padding: 24 }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 18, color: colors.navy }}>
            Folder not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !folder) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.navy} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !folder) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar />
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 18, color: colors.navy }}>
            Non siamo riusciti a caricare questa cartella.
          </Text>
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova a caricare la cartella"
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.warmWhite,
              borderWidth: 1.5,
              borderColor: colors.navy,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
              Riprova
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const data = folder;

  // Folder-scoped "Review now" is intentionally a single-layer Scan, not
  // the full Scan → Reinforcement → Focus flow. Initialize the store
  // before navigating so the Scan screen's flow-default fallback no-ops.
  const startReview = () => {
    startSession("scan", "single");
    router.push("/review/scan");
  };
  const addItem = () => router.push("/add");

  // Tip rotated per-day so re-entering the folder shows fresh advice but
  // not a new tip on every render.
  const folderTip = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return pickCategoryTip(kind, dayOfYear);
  }, [kind]);

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <FolderTopBar kind={kind} name={data.name} priority={data.priority} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial hero — title + sub-line only. No tile (it lives in the top bar). */}
        <View style={{ paddingHorizontal: 22, paddingTop: 14 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: FONT.bold,
              fontSize: 28,
              color: colors.navy,
              letterSpacing: -0.84,
              lineHeight: 31,
            }}
          >
            {data.name}
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13,
              color: colors.midGrey,
              marginTop: 5,
              fontVariant: ["tabular-nums"],
            }}
          >
            {data.count} ricordi · {data.addedThisWeek} aggiunti questa settimana
          </Text>
        </View>

        {/* Stats card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 16,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <RetentionBar
              active={data.active}
              fading={data.fading}
              archived={data.archived}
              width="100%"
              height={10}
            />
            <View className="mt-4 flex-row" style={{ justifyContent: "space-between" }}>
              <StatBlock
                dot={colors.active}
                label="Stabili"
                pct={data.active}
                count={Math.round((data.count * data.active) / 100)}
              />
              <StatBlock
                dot={colors.fading}
                label="In dissolvenza"
                pct={data.fading}
                count={Math.round((data.count * data.fading) / 100)}
              />
              <StatBlock
                dot={colors.archived}
                label="Archiviati"
                pct={data.archived}
                count={Math.round((data.count * data.archived) / 100)}
              />
            </View>
          </View>
        </View>

        {/* Category-specific coach tip (e.g. languages tip for jp/es) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <CoachTip tip={folderTip} persistDismiss={false} />
        </View>

        {/* Quick actions */}
        <View
          className="flex-row"
          style={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}
        >
          <ActionPill
            icon={Repeat}
            label="Ripassa ora"
            color={colors.reinforcement}
            onPress={startReview}
          />
          <ActionPill icon={Plus} label="Aggiungi" color={colors.navy} onPress={addItem} />
        </View>

        {/* Filters */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10 }}>
          <SectionLabel>Ricordi</SectionLabel>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
        >
          <FilterChip
            label="Tutti"
            count={counts.all}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label="Stabili"
            count={counts.active}
            active={filter === "active"}
            dot={colors.active}
            onPress={() => setFilter("active")}
          />
          <FilterChip
            label="In dissolvenza"
            count={counts.fading}
            active={filter === "fading"}
            dot={colors.fading}
            onPress={() => setFilter("fading")}
          />
          <FilterChip
            label="Archiviati"
            count={counts.archived}
            active={filter === "archived"}
            dot={colors.archived}
            onPress={() => setFilter("archived")}
          />
        </ScrollView>

        {/* Item list */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {filtered.length === 0 ? (
            <Text
              style={{
                fontFamily: FONT.regular,
                fontStyle: "italic",
                textAlign: "center",
                color: colors.midGrey,
                fontSize: 13.5,
                paddingVertical: 32,
              }}
            >
              Nessun ricordo in questo stato.
            </Text>
          ) : (
            filtered.map((item, i) => <ItemRow key={item.front + i} item={item} />)
          )}
        </View>
      </ScrollView>

      {/* FAB — `bottom: 110` clears the absolute tab bar (~84 high). */}
      <Pressable
        onPress={addItem}
        accessibilityRole="button"
        accessibilityLabel="Add a memory to this folder"
        style={({ pressed }) => ({
          position: "absolute",
          right: 22,
          bottom: 110,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.navy,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.navy,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 10 },
          shadowRadius: 24,
          elevation: 8,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Plus size={24} color={colors.warmWhite} strokeWidth={2.2} />
      </Pressable>
    </SafeAreaView>
  );
}
