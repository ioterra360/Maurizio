import { useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { Plus } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { FolderRow } from "@/components/FolderRow";
import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { Tappable } from "@/components/Tappable";
import { useFoldersWithStats } from "@/lib/use-folders";
import type { FolderWithStats } from "@/lib/mappers";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { markAddOpenedIntentionally } from "@/lib/add-gate";
import { FONT, colors } from "@/theme/tokens";
import { FOLDER_LIMIT_ENFORCED, FOLDER_TEMPLATES, type FolderKind } from "@/lib/constants";

export default function KnowledgeScreen() {
  const { folders, loading, error, refetch } = useFoldersWithStats();
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
    }, [refetch]),
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
          name={item.name}
          priority={(getIndex() ?? 0) + 1}
          count={item.count}
          active={item.active}
          fading={item.fading}
          archived={item.archived}
          paused={item.paused}
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

  // Test phase (FOLDER_LIMIT_ENFORCED=false): one folder per kind, so the
  // button disappears once the 4 templates + the custom one all exist.
  const canAddFolder =
    !FOLDER_LIMIT_ENFORCED &&
    !loading &&
    !error &&
    folders.length > 0 &&
    folders.length < FOLDER_TEMPLATES.length + 1;

  const header = (
    <View style={{ position: "relative" }}>
      <HeaderHero
        title="Le tue cartelle"
        subtitle={
          loading
            ? "Caricamento delle tue cartelle…"
            : folders.length === 0
              ? "Nessuna cartella attiva"
              : folders.length === 1
                ? "1 cartella attiva"
                : `${folders.length} cartelle attive · trascina per cambiare priorità`
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
            accessibilityLabel="Nuova cartella"
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
              Nuova cartella
            </Text>
          </Tappable>
        </View>
      ) : null}
    </View>
  );

  const empty =
    loading && folders.length === 0 ? (
      <View style={{ paddingVertical: 48, alignItems: "center" }}>
        <MascotLoader label="Carico le tue cartelle…" />
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
          <Tappable
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Riprova a caricare le cartelle"
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
              Riprova
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
            Nessuna cartella, per ora.
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            Scegli l'argomento che vuoi proteggere dall'oblio: Memika creerà
            la tua cartella e potrai aggiungere il primo ricordo.
          </Text>
          <Tappable
            onPress={() => router.push("/choose-topic" as never)}
            accessibilityRole="button"
            accessibilityLabel="Scegli il tuo argomento"
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
              Scegli il tuo argomento
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
        onDragEnd={({ data }) => setOrder(data.map((f) => f.kind as FolderKind))}
        ListHeaderComponent={header}
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
        accessibilityLabel="Aggiungi un nuovo ricordo"
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
        <Plus size={22} color={colors.warmWhite} strokeWidth={2.2} />
      </Tappable>
      )}
    </SafeAreaView>
  );
}
