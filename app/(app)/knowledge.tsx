import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Plus, Trash2 } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { FolderRow } from "@/components/FolderRow";
import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { Tappable } from "@/components/Tappable";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats } from "@/lib/mappers";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { fetchTrash, updateFolderPriorities } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { reportError } from "@/lib/report-error";
import { markAddOpenedIntentionally } from "@/lib/add-gate";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";
import { FOLDER_LIMIT_ENFORCED, type FolderKind } from "@/lib/constants";

export default function KnowledgeScreen() {
  const { t, tp } = useT();
  const colors = useColors();
  const userId = useAuthStore((s) => s.user?.id);
  const { folders, loading, error, refetch } = useFoldersWithStats();
  // Quanti elementi (cartelle + ricordi singoli) sono nel cestino: la riga
  // "Cestino" in fondo alla lista compare solo se > 0. Errori silenziosi:
  // la riga resta con l'ultimo valore noto, Impostazioni è la via di riserva.
  const [trashCount, setTrashCount] = useState(0);
  const loadTrashCount = useCallback(async () => {
    if (!userId) return;
    try {
      const trash = await fetchTrash(userId);
      setTrashCount(trash.folders.length + trash.memories.length);
    } catch (e) {
      reportError("knowledge/trash-count", e);
    }
  }, [userId]);
  useEffect(() => {
    void loadTrashCount();
  }, [loadTrashCount]);
  const order = useFolderOrderStore((s) => s.order);
  const hydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  const setOrder = useFolderOrderStore((s) => s.setOrder);

  useEffect(() => {
    if (!hydrated) void hydrateOrder();
  }, [hydrated, hydrateOrder]);

  // Refetch every time the tab regains focus: the folder created on
  // /choose-topic (pushed on top of this tab) must show up when the user
  // comes back, and the FAB must appear. The hook already fetched on
  // mount, so the very first focus is skipped. No loader flash: the
  // MascotLoader below only renders while the list is still empty.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      refetch();
      void loadTrashCount();
    }, [refetch, loadTrashCount]),
  );

  const orderedFolders = useMemo(
    () => applyFolderOrder(folders, order),
    [folders, order],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<FolderWithStats>) => (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <FolderRow
          kind={item.kind as FolderKind}
          emoji={item.emoji}
          name={item.name}
          priority={(getIndex() ?? 0) + 1}
          count={item.count}
          active={item.active}
          fading={item.fading}
          archived={item.archived}
          paused={item.paused}
          onPress={() =>
            router.push({ pathname: "/folder/[id]", params: { id: item.id } })
          }
          onDrag={drag}
          isActive={isActive}
        />
      </View>
    ),
    [],
  );

  // Test phase (FOLDER_LIMIT_ENFORCED=false): one folder per kind, so the
  // button disappears once the 4 templates + the custom one all exist.
  // Nessun tetto numerico dal 2026-09-02 (via unique(user_id,kind) e via i
  // 5 slot): il confine tornera' coi piani Free/Pro/Premium, non qui.
  const canAddFolder = !FOLDER_LIMIT_ENFORCED && !loading && !error && folders.length > 0;

  const header = (
    <View style={{ position: "relative" }}>
      <HeaderHero
        title={t("knowledge.title")}
        subtitle={
          loading
            ? t("knowledge.loadingSubtitle")
            : folders.length === 0
              ? t("knowledge.noActiveFolders")
              : tp("knowledge.activeFolders", folders.length)
        }
        reservedRight={108}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 2, right: 14 }}
      >
        <Mascot variant="checklist" size={92} withShadow={false} />
      </View>
      {canAddFolder ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Tappable
            onPress={() =>
              router.push({ pathname: "/choose-topic", params: { mode: "new" } } as never)
            }
            accessibilityRole="button"
            accessibilityLabel={t("knowledge.newFolder")}
            containerStyle={{ alignSelf: "flex-start" }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: colors.navy,
            }}
          >
            <Plus size={16} color={colors.navy} strokeWidth={2.2} />
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
              {t("knowledge.newFolder")}
            </Text>
          </Tappable>
        </View>
      ) : null}
    </View>
  );

  const empty =
    loading && folders.length === 0 ? (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <MascotLoader label={t("knowledge.loadingFolders")} />
      </View>
    ) : error ? (
      <View style={{ paddingHorizontal: 16 }}>
        <View
          className="rounded-card bg-surface"
          style={{
            padding: 18,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: "center",
            gap: 10,
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
            {t("knowledge.loadErrorTitle")}
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            {t("knowledge.loadErrorBody")}
          </Text>
          <Tappable
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel={t("knowledge.retryLoadAccessibility")}
            containerStyle={{ marginTop: 4 }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.warmWhite,
              borderWidth: 1.5,
              borderColor: colors.navy,
            }}
          >
            <Text
              style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}
            >
              {t("common.retry")}
            </Text>
          </Tappable>
        </View>
      </View>
    ) : (
      <View style={{ paddingHorizontal: 16 }}>
        <View
          className="rounded-card bg-surface"
          style={{
            padding: 18,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: "center",
            gap: 10,
          }}
        >
          <Mascot variant="investigate" size={84} withShadow={false} />
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 15,
              color: colors.navy,
              textAlign: "center",
            }}
          >
            {t("knowledge.emptyTitle")}
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            {t("knowledge.emptyBody")}
          </Text>
          <Tappable
            onPress={() => router.push("/choose-topic" as never)}
            accessibilityRole="button"
            accessibilityLabel={t("knowledge.chooseTopic")}
            containerStyle={{ marginTop: 4 }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.warmWhite,
              borderWidth: 1.5,
              borderColor: colors.navy,
            }}
          >
            <Text
              style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}
            >
              {t("knowledge.chooseTopic")}
            </Text>
          </Tappable>
        </View>
      </View>
    );

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <DraggableFlatList
        data={error ? [] : orderedFolders}
        keyExtractor={(f) => f.kind}
        renderItem={renderItem}
        onDragEnd={({ data }) => {
          setOrder(data.map((f) => f.id));
          // Mirror to folders.priority: the review deck fills from the top
          // folder first (lib/queue.ts allocateByFolderPriority).
          void updateFolderPriorities(data.map((f, i) => ({ id: f.id, priority: i + 1 }))).catch(
            (e) => {
              reportError("knowledge/update-priorities", e);
            },
          );
        }}
        ListHeaderComponent={header}
        ListFooterComponent={
          trashCount > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
              <Tappable
                onPress={() => router.push("/trash" as never)}
                accessibilityRole="button"
                accessibilityLabel={t("knowledge.trashRow")}
                pressedOpacity={0.85}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <Trash2 size={17} color={colors.midGrey} strokeWidth={1.9} />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: FONT.semibold,
                    fontSize: 14.5,
                    color: colors.navy,
                    letterSpacing: -0.1,
                  }}
                >
                  {t("knowledge.trashRow")}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 12.5,
                    color: colors.midGrey,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {tp("knowledge.trashRowCount", trashCount)}
                </Text>
              </Tappable>
            </View>
          ) : null
        }
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        containerStyle={{ flex: 1 }}
      />

      {/* FAB — opens Add MEMORY. Folders are created from the "Nuova
          cartella" pill in the header (test phase) or at onboarding.
          Hidden while the user has none. */}
      {!loading && !error && folders.length === 0 ? null : (
      <Tappable
        onPress={() => {
          markAddOpenedIntentionally();
          router.push("/add");
        }}
        accessibilityRole="button"
        accessibilityLabel={t("knowledge.addMemoryAccessibility")}
        containerStyle={{
          position: "absolute",
          right: 22,
          bottom: 104,
        }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#0F1B33",
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 10 },
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <Plus size={22} color={colors.onAccent} strokeWidth={2.2} />
      </Tappable>
      )}
    </SafeAreaView>
  );
}
