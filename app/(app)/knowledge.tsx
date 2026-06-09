import { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Plus } from "lucide-react-native";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { FolderRow } from "@/components/FolderRow";
import { Mascot } from "@/components/Mascot";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats } from "@/lib/mappers";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { markAddOpenedIntentionally } from "@/lib/add-gate";
import { FONT, colors } from "@/theme/tokens";
import type { FolderKind } from "@/lib/constants";

export default function KnowledgeScreen() {
  const { folders, loading, error, refetch } = useFoldersWithStats();
  const order = useFolderOrderStore((s) => s.order);
  const hydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  const setOrder = useFolderOrderStore((s) => s.setOrder);

  useEffect(() => {
    if (!hydrated) void hydrateOrder();
  }, [hydrated, hydrateOrder]);

  const orderedFolders = useMemo(
    () => applyFolderOrder(folders, order),
    [folders, order],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<FolderWithStats>) => (
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <FolderRow
          kind={item.kind as FolderKind}
          name={item.name}
          priority={(getIndex() ?? 0) + 1}
          count={item.count}
          active={item.active}
          fading={item.fading}
          archived={item.archived}
          onPress={() =>
            router.push({ pathname: "/folder/[kind]", params: { kind: item.kind } })
          }
          onDrag={drag}
          isActive={isActive}
        />
      </View>
    ),
    [],
  );

  const header = (
    <View style={{ position: "relative" }}>
      <HeaderHero
        title="Le tue cartelle"
        subtitle={
          loading
            ? "Caricamento delle tue cartelle…"
            : `${folders.length} cartelle attive · trascina per cambiare priorità`
        }
        reservedRight={80}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 14, right: 18 }}
      >
        <Mascot variant="checklist" size={64} withShadow={false} />
      </View>
    </View>
  );

  const empty =
    loading && folders.length === 0 ? (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <ActivityIndicator color={colors.navy} />
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
            Non siamo riusciti a caricare le tue cartelle.
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            Controlla la connessione e riprova.
          </Text>
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova a caricare le cartelle"
            style={({ pressed }) => ({
              marginTop: 4,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.warmWhite,
              borderWidth: 1.5,
              borderColor: colors.navy,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}
            >
              Riprova
            </Text>
          </Pressable>
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <DraggableFlatList
        data={error ? [] : orderedFolders}
        keyExtractor={(f) => f.kind}
        renderItem={renderItem}
        onDragEnd={({ data }) => setOrder(data.map((f) => f.kind as FolderKind))}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        containerStyle={{ flex: 1 }}
      />

      {/* FAB */}
      <Pressable
        onPress={() => {
          markAddOpenedIntentionally();
          router.push("/add");
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a new memory"
        style={({ pressed }) => ({
          position: "absolute",
          right: 22,
          bottom: 104,
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
