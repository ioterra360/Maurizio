import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { FolderRow } from "@/components/FolderRow";
import { Mascot } from "@/components/Mascot";
import { useFoldersWithStats } from "@/lib/use-folders";
import { applyFolderOrder, useFolderOrderStore } from "@/lib/folder-order-store";
import { FONT, colors } from "@/theme/tokens";
import type { FolderKind } from "@/lib/constants";

export default function KnowledgeScreen() {
  const { folders, loading, error, refetch } = useFoldersWithStats();
  const order = useFolderOrderStore((s) => s.order);
  const hydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  const moveFolder = useFolderOrderStore((s) => s.move);

  useEffect(() => {
    if (!hydrated) void hydrateOrder();
  }, [hydrated, hydrateOrder]);

  const orderedFolders = useMemo(
    () => applyFolderOrder(folders, order),
    [folders, order],
  );

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <HeaderHero
            title="Le tue cartelle"
            subtitle={
              loading
                ? "Caricamento delle tue cartelle…"
                : `${folders.length} cartelle attive · riordinale con le frecce`
            }
          />
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 14, right: 18 }}
          >
            <Mascot variant="checklist" size={64} withShadow={false} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {loading && folders.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={colors.navy} />
            </View>
          ) : error ? (
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
                  fontSize: 14,
                  color: colors.navy,
                  textAlign: "center",
                }}
              >
                We couldn't load your folders.
              </Text>
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 12.5,
                  color: colors.midGrey,
                  textAlign: "center",
                }}
              >
                Check your connection and try again.
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
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 14,
                    color: colors.navy,
                  }}
                >
                  Riprova
                </Text>
              </Pressable>
            </View>
          ) : (
            orderedFolders.map((f, i) => (
              <FolderRow
                key={f.kind}
                kind={f.kind as FolderKind}
                name={f.name}
                priority={i + 1}
                count={f.count}
                active={f.active}
                fading={f.fading}
                archived={f.archived}
                onPress={() =>
                  router.push({ pathname: "/folder/[kind]", params: { kind: f.kind } })
                }
                onMoveUp={() => moveFolder(f.kind as FolderKind, "up")}
                onMoveDown={() => moveFolder(f.kind as FolderKind, "down")}
                canMoveUp={i > 0}
                canMoveDown={i < orderedFolders.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/add")}
        accessibilityRole="button"
        accessibilityLabel="Add a new memory"
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
