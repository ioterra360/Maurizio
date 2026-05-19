import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { FolderRow } from "@/components/FolderRow";
import { getAllFolderSeeds } from "@/lib/folder-data";
import { colors } from "@/theme/tokens";

export default function KnowledgeScreen() {
  const folders = getAllFolderSeeds();

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <HeaderHero
          title="Your knowledge"
          subtitle={`${folders.length} active folders · adjust priorities anytime`}
        />

        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {folders.map((f) => (
            <FolderRow
              key={f.kind}
              kind={f.kind}
              name={f.name}
              priority={f.priority}
              count={f.count}
              active={f.active}
              fading={f.fading}
              archived={f.archived}
              onPress={() => router.push({ pathname: "/folder/[kind]", params: { kind: f.kind } })}
            />
          ))}
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
        <Plus size={24} color="#fff" strokeWidth={2.2} />
      </Pressable>
    </SafeAreaView>
  );
}
