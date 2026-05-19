import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Repeat, Settings as SettingsIcon } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { FolderTile } from "@/components/FolderTile";
import { RetentionBar } from "@/components/RetentionBar";
import { StatBlock } from "@/components/StatBlock";
import { ActionPill } from "@/components/ActionPill";
import { FilterChip } from "@/components/FilterChip";
import { ItemRow } from "@/components/ItemRow";
import { SectionLabel } from "@/components/SectionLabel";
import { getFolderSeed } from "@/lib/folder-data";
import { FONT, colors } from "@/theme/tokens";
import { FOLDER_KINDS, type FolderKind, type MemoryState } from "@/lib/constants";

export default function FolderDetailScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : null;
  const data = kind ? getFolderSeed(kind) : null;
  const [filter, setFilter] = useState<"all" | MemoryState>("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.items;
    return data.items.filter((i) => i.state === filter);
  }, [filter, data]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, active: 0, fading: 0, archived: 0 };
    return {
      all: data.items.length,
      active: data.items.filter((i) => i.state === "active").length,
      fading: data.items.filter((i) => i.state === "fading").length,
      archived: data.items.filter((i) => i.state === "archived").length,
    };
  }, [data]);

  if (!data) {
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

  const startReview = () => router.push("/review/scan");
  const addItem = () => router.push("/add");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar
        title={data.name}
        rightSlot={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Folder settings"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <SettingsIcon size={20} color={colors.navy} strokeWidth={1.7} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          className="flex-row items-center"
          style={{ paddingHorizontal: 24, paddingTop: 14, gap: 12 }}
        >
          <FolderTile kind={data.kind} size={44} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 28,
                color: colors.navy,
                letterSpacing: -0.9,
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
                marginTop: 4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {data.count} items · added {data.addedThisWeek} this week
            </Text>
          </View>
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
                label="Active"
                pct={data.active}
                count={Math.round((data.count * data.active) / 100)}
              />
              <StatBlock
                dot={colors.fading}
                label="Fading"
                pct={data.fading}
                count={Math.round((data.count * data.fading) / 100)}
              />
              <StatBlock
                dot="#9C9C95"
                label="Archived"
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
            label="Review now"
            color={colors.reinforcement}
            onPress={startReview}
          />
          <ActionPill icon={Plus} label="Add item" color={colors.navy} onPress={addItem} />
        </View>

        {/* Filters */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
          <SectionLabel>Items</SectionLabel>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }}
        >
          <FilterChip
            label="All"
            count={counts.all}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label="Active"
            count={counts.active}
            active={filter === "active"}
            dot={colors.active}
            onPress={() => setFilter("active")}
          />
          <FilterChip
            label="Fading"
            count={counts.fading}
            active={filter === "fading"}
            dot={colors.fading}
            onPress={() => setFilter("fading")}
          />
          <FilterChip
            label="Archived"
            count={counts.archived}
            active={filter === "archived"}
            dot="#9C9C95"
            onPress={() => setFilter("archived")}
          />
        </ScrollView>

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
              Nothing in this state.
            </Text>
          ) : (
            filtered.map((item, i) => <ItemRow key={item.front + i} item={item} />)
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={addItem}
        accessibilityRole="button"
        accessibilityLabel="Add a memory to this folder"
        style={({ pressed }) => ({
          position: "absolute",
          right: 22,
          bottom: 30,
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
        <Plus size={24} color="#fff" strokeWidth={2.2} />
      </Pressable>
    </SafeAreaView>
  );
}
