import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { AdminTopBar } from "@/components/AdminTopBar";
import { InitialsAvatar } from "@/components/FolderTile";
import { FilterChip } from "@/components/FilterChip";
import { USERS, type AdminUser } from "@/lib/admin-data";
import { FONT, colors } from "@/theme/tokens";

type PlanFilter = "all" | "Pro" | "Free" | "At risk";

const PLAN_TINT: Record<AdminUser["plan"], { bg: string; text: string }> = {
  Pro:          { bg: "#EEEAFB", text: "#5A4DB1" }, // violet — Pro identity
  Free:         { bg: "#EFEDE7", text: "#7A7975" },
  "At risk":    { bg: "#FDEEEA", text: "#A65B4A" },
};

const RETENTION_PILL: Record<"high" | "med" | "low", { bg: string; text: string }> = {
  high: { bg: "#E7F5EE", text: "#1F8552" },
  med:  { bg: "#EFEDE7", text: "#5C5A55" },
  low:  { bg: "#FDEEEA", text: "#A65B4A" },
};

export default function AdminUsersScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PlanFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USERS.filter((u) => {
      if (filter !== "all" && u.plan !== filter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [query, filter]);

  const counts = useMemo(
    () => ({
      all: USERS.length,
      Pro: USERS.filter((u) => u.plan === "Pro").length,
      Free: USERS.filter((u) => u.plan === "Free").length,
      atRisk: USERS.filter((u) => u.plan === "At risk").length,
    }),
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <AdminTopBar title="Users" subtitle={`${counts.all} total · ${counts.atRisk} at risk`} />

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        <View
          className="flex-row items-center rounded-chip bg-surface"
          style={{
            paddingHorizontal: 12,
            paddingVertical: 9,
            gap: 8,
            borderWidth: 1,
            borderColor: colors.hairline,
          }}
        >
          <Search size={16} color={colors.midGrey} strokeWidth={1.8} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or email"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              fontFamily: FONT.medium,
              fontSize: 13.5,
              color: colors.navy,
              padding: 0,
            }}
          />
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      >
        <FilterChip
          label="All"
          count={counts.all}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Pro"
          count={counts.Pro}
          active={filter === "Pro"}
          dot={colors.active}
          onPress={() => setFilter("Pro")}
        />
        <FilterChip
          label="Free"
          count={counts.Free}
          active={filter === "Free"}
          dot="#9C9C95"
          onPress={() => setFilter("Free")}
        />
        <FilterChip
          label="At risk"
          count={counts.atRisk}
          active={filter === "At risk"}
          dot={colors.fading}
          onPress={() => setFilter("At risk")}
        />
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120, gap: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              color: colors.midGrey,
              textAlign: "center",
              fontStyle: "italic",
              paddingVertical: 32,
            }}
          >
            No users matching that.
          </Text>
        ) : (
          filtered.map((u) => <UserRow key={u.id} user={u} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const tint = PLAN_TINT[user.plan];
  const retentionPill =
    user.retention >= 75 ? RETENTION_PILL.high :
    user.retention >= 50 ? RETENTION_PILL.med :
    RETENTION_PILL.low;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${user.name} details`}
      className="flex-row items-center rounded-chip bg-surface"
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 11,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <InitialsAvatar initials={user.initials} size={36} variant="user" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 14,
              color: colors.navy,
              letterSpacing: -0.08,
            }}
            numberOfLines={1}
          >
            {user.name}
          </Text>
          <View
            className="rounded-tag"
            style={{
              backgroundColor: tint.bg,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 9.5,
                color: tint.text,
                letterSpacing: 0.3,
              }}
            >
              {user.plan.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 11.5,
            color: colors.midGrey,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {user.email}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View
          className="rounded-tag"
          style={{
            backgroundColor: retentionPill.bg,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 11,
              color: retentionPill.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {user.retention}%
          </Text>
        </View>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 10.5,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {user.lastSeen}
        </Text>
      </View>
    </Pressable>
  );
}
