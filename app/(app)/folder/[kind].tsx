import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpDown, Plus, Repeat } from "lucide-react-native";

import { NamePromptModal } from "@/components/NamePromptModal";
import { createSubfolder, fetchSubfolders } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { reportError } from "@/lib/report-error";
import { useUIStore } from "@/lib/ui-store";
import { SUBFOLDERS_MAX } from "@/lib/constants";
import type { Subfolder } from "@/lib/mappers";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { FolderTopBar } from "@/components/FolderTopBar";
import { MascotLoader } from "@/components/MascotLoader";
import { RetentionBar } from "@/components/RetentionBar";
import { StatBlock } from "@/components/StatBlock";
import { ActionPill } from "@/components/ActionPill";
import { FilterChip } from "@/components/FilterChip";
import { ItemRow } from "@/components/ItemRow";
import { SectionLabel } from "@/components/SectionLabel";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";
import { useT } from "@/lib/i18n";
import { FOLDER_KINDS, type FolderKind, type MemoryState } from "@/lib/constants";
import { useFolderDetail } from "@/lib/use-folders";
import { priorityOf, useFolderOrderStore } from "@/lib/folder-order-store";
import { useReviewStore } from "@/lib/review-store";
import { relativeReviewed } from "@/lib/format";
import { layerFor } from "@/lib/queue";
import { sortMemories } from "@/lib/folder-sort";
import { useFolderSortStore } from "@/lib/folder-sort-store";
import { FolderSortSheet, SORT_LABEL_KEY } from "@/components/FolderSortSheet";
import { markAddOpenedIntentionally } from "@/lib/add-gate";
import type { FolderItem } from "@/lib/folder-data";

export default function FolderDetailScreen() {
  const { t, tp } = useT();
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : null;
  const { folder, items, loading, error, refetch } = useFolderDetail(kind);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const order = useFolderOrderStore((s) => s.order);
  // Sezioni della cartella (sottocartelle): chips sotto i filtri di stato.
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [subFilter, setSubFilter] = useState<"all" | string>("all");
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subSaving, setSubSaving] = useState(false);
  const folderId = folder?.id ?? null;
  const loadSubfolders = useCallback(async () => {
    if (!folderId) return;
    try {
      const subs = await fetchSubfolders(folderId);
      setSubfolders(subs);
      setSubFilter((cur) => (cur === "all" || subs.some((s) => s.id === cur) ? cur : "all"));
    } catch (e) {
      reportError("folder/subfolders-load", e);
    }
  }, [folderId]);
  useEffect(() => {
    void loadSubfolders();
  }, [loadSubfolders]);
  const startSession = useReviewStore((s) => s.start);
  const [filter, setFilter] = useState<"all" | MemoryState>("all");
  // Ordinamento della lista, ricordato per cartella (lib/folder-sort-store).
  const sort = useFolderSortStore((s) => (kind ? s.sortFor(kind) : "due"));
  const setSort = useFolderSortStore((s) => s.setSort);
  const [sortOpen, setSortOpen] = useState(false);
  const sortedItems = useMemo(() => sortMemories(items, sort), [items, sort]);
  // Filtro per sezione PRIMA dell'adattatore di visualizzazione.
  const sectionedItems = useMemo(
    () =>
      subFilter === "all"
        ? sortedItems
        : sortedItems.filter((m) => (m.subfolderId ?? null) === subFilter),
    [sortedItems, subFilter],
  );

  // Refetch on focus — the name can change in folder-settings, and the hook
  // itself only loads on mount. Runs before the early returns (hooks rule).
  useFocusEffect(
    useCallback(() => {
      refetch();
      void loadSubfolders();
    }, [refetch, loadSubfolders]),
  );

  // Memory (api/db model) → FolderItem (UI/display model) adapter. Kept
  // inline so we can rip it out when ItemRow accepts Memory directly.
  const displayItems = useMemo<FolderItem[]>(
    () =>
      sectionedItems.map((m) => ({
        id: m.id,
        front: m.term,
        reading: m.reading ?? undefined,
        back: m.definition,
        state: m.state,
        reviewed: relativeReviewed(m.lastReviewedAt),
        layer: layerFor(m.srs.repetitions, m.state) ?? undefined,
      })),
    [sectionedItems],
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
            {t("folder.notFound")}
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
          <MascotLoader label={t("folder.openingFolder")} />
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
            {t("folder.loadFailed")}
          </Text>
          <Tappable
            onPress={refetch}
            accessibilityLabel={t("folder.retryLoadA11y")}
            containerStyle={{ alignSelf: "flex-start" }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.warmWhite,
              borderWidth: 1.5,
              borderColor: colors.navy,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
              {t("common.retry")}
            </Text>
          </Tappable>
        </View>
      </SafeAreaView>
    );
  }

  const data = folder;

  // Folder-scoped "Review now" is intentionally a single-layer Scan, not
  // the full Scan → Reinforcement → Focus flow. Initialize the store
  // before navigating so the Scan screen's flow-default fallback no-ops.
  const startReview = () => {
    startSession("scan", "single", { folderKind: kind, folderId: data.id, budgetCap: 28 });
    router.push("/review/scan");
  };
  const addItem = () => {
    markAddOpenedIntentionally();
    router.push({ pathname: "/add", params: { kind } });
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <FolderTopBar kind={kind} name={data.name} priority={priorityOf(kind, order)} />

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
              // ≥1.25× font-size so descenders don't clip (see tailwind.config.js)
              lineHeight: 35,
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
            {tp("folder.heroSummary", data.count, { addedThisWeek: data.addedThisWeek })}
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
                label={t("folder.stateStable")}
                pct={data.active}
                count={Math.round((data.count * data.active) / 100)}
              />
              <StatBlock
                dot={colors.fading}
                label={t("folder.stateFading")}
                pct={data.fading}
                count={Math.round((data.count * data.fading) / 100)}
              />
              <StatBlock
                dot={colors.archived}
                label={t("folder.stateArchived")}
                pct={data.archived}
                count={Math.round((data.count * data.archived) / 100)}
              />
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View
          className="flex-row"
          style={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}
        >
          <ActionPill
            icon={Repeat}
            label={t("folder.reviewNow")}
            color={colors.reinforcement}
            disabled={data.paused}
            onPress={startReview}
          />
          <ActionPill icon={Plus} label={t("folder.add")} color={colors.navy} onPress={addItem} />
        </View>
        {data.paused ? (
          <Text
            style={{
              paddingHorizontal: 22,
              paddingTop: 8,
              fontFamily: FONT.regular,
              fontSize: 12.5,
              color: colors.midGrey,
            }}
          >
            {t("folder.pausedNotice")}
          </Text>
        ) : null}

        {/* Filters + sort */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingLeft: 22, paddingRight: 16, paddingTop: 20, paddingBottom: 10 }}
        >
          <SectionLabel>{t("folder.memoriesSection")}</SectionLabel>
          <Tappable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("folder.sortA11y", { current: t(SORT_LABEL_KEY[sort]) })}
            pressedOpacity={0.6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: radii.filter,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.warmWhite,
            }}
          >
            <ArrowUpDown size={15} color={colors.navy} strokeWidth={1.9} />
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 13.5,
                color: colors.navy,
                letterSpacing: -0.07,
              }}
            >
              {t(SORT_LABEL_KEY[sort])}
            </Text>
          </Tappable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
        >
          <FilterChip
            label={t("folder.filterAll")}
            count={counts.all}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label={t("folder.stateStable")}
            count={counts.active}
            active={filter === "active"}
            dot={colors.active}
            onPress={() => setFilter("active")}
          />
          <FilterChip
            label={t("folder.stateFading")}
            count={counts.fading}
            active={filter === "fading"}
            dot={colors.fading}
            onPress={() => setFilter("fading")}
          />
          <FilterChip
            label={t("folder.stateArchived")}
            count={counts.archived}
            active={filter === "archived"}
            dot={colors.archived}
            onPress={() => setFilter("archived")}
          />
        </ScrollView>

        {/* Sezioni (sottocartelle) — max SUBFOLDERS_MAX per cartella. */}
        {subfolders.length > 0 || subfolders.length < SUBFOLDERS_MAX ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
          >
            {subfolders.length > 0 ? (
              <FilterChip
                label={t("subfolders.chipAll")}
                count={items.length}
                active={subFilter === "all"}
                onPress={() => setSubFilter("all")}
              />
            ) : null}
            {subfolders.map((s) => (
              <FilterChip
                key={s.id}
                label={s.name}
                count={items.filter((m) => (m.subfolderId ?? null) === s.id).length}
                active={subFilter === s.id}
                onPress={() => setSubFilter(s.id)}
              />
            ))}
            {subfolders.length < SUBFOLDERS_MAX ? (
              <Tappable
                onPress={() => setSubModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("subfolders.add")}
                pressedOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  height: 32,
                  paddingHorizontal: 12,
                  borderRadius: radii.filter,
                  borderWidth: 1,
                  borderColor: colors.hairlineStrong,
                  borderStyle: "dashed",
                  backgroundColor: colors.warmWhite,
                }}
              >
                <Plus size={13} color={colors.navy} strokeWidth={2.2} />
                <Text style={{ fontFamily: FONT.medium, fontSize: 13, color: colors.navy }}>
                  {t("subfolders.add")}
                </Text>
              </Tappable>
            ) : null}
          </ScrollView>
        ) : null}

        {/* Item list */}
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
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
              {t("folder.emptyState")}
            </Text>
          ) : (
            filtered.map((item, i) => (
              <ItemRow
                key={item.id ?? item.front + i}
                item={item}
                onPress={
                  item.id
                    ? () =>
                        router.push({ pathname: "/memory/[id]", params: { id: item.id } } as never)
                    : undefined
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB — the folder screen lives inside the tab navigator, so it must
          clear the tab bar like the Knowledge FAB does (it used to sit behind
          "Impostazioni" — Angelo, 2026-08-27). */}
      <Tappable
        onPress={addItem}
        accessibilityLabel={t("folder.fabAddA11y")}
        containerStyle={{
          position: "absolute",
          right: 22,
          bottom: 104,
        }}
        style={{
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
        }}
      >
        <Plus size={24} color={colors.warmWhite} strokeWidth={2.2} />
      </Tappable>

      <FolderSortSheet
        visible={sortOpen}
        current={sort}
        onSelect={(next) => {
          if (kind) setSort(kind, next);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />

      <NamePromptModal
        visible={subModalOpen}
        title={t("subfolders.addTitle")}
        placeholder={t("subfolders.namePlaceholder")}
        saving={subSaving}
        onClose={() => {
          if (!subSaving) setSubModalOpen(false);
        }}
        onSave={(name) => {
          if (!user || !folderId || subSaving) return;
          setSubSaving(true);
          createSubfolder(user.id, folderId, name)
            .then(() => {
              setSubModalOpen(false);
              showToast(t("subfolders.created", { name }));
              void loadSubfolders();
            })
            .catch((e) => {
              reportError("folder/subfolder-create", e);
              const msg = e instanceof Error ? e.message : String(e);
              showToast(
                msg.includes("limit") ? t("subfolders.limit") : t("subfolders.failed"),
              );
            })
            .finally(() => setSubSaving(false));
        }}
      />
    </SafeAreaView>
  );
}
