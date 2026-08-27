import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { AdminTopBar } from "@/components/AdminTopBar";
import { InitialsAvatar } from "@/components/FolderTile";
import { FilterChip } from "@/components/FilterChip";
import { Tappable } from "@/components/Tappable";
import { USERS, type AdminUser } from "@/lib/admin-data";
import { FONT, colors, radii, statusTint } from "@/theme/tokens";
import { t, useT } from "@/lib/i18n";

type PlanFilter = "all" | "Pro" | "Free" | "At risk";

const PLAN_TINT: Record<AdminUser["plan"], { bg: string; text: string }> = {
  Pro:          { bg: colors.tagProBg, text: colors.tagProText },
  Free:         statusTint.archived,
  "At risk":    statusTint.fading,
};

/** Display labels for the plan pill — plan union literals stay English (they key filters/tints). */
const PLAN_LABEL: Record<AdminUser["plan"], string> = {
  Pro: "PRO",
  Free: "FREE",
  get "At risk"() { return t("adminUsers.tagAtRisk"); },
};

const RETENTION_PILL: Record<"high" | "med" | "low", { bg: string; text: string }> = {
  high: statusTint.active,
  med:  statusTint.archived,
  low:  statusTint.fading,
};

export default function AdminUsersScreen() {
  const { t: tr } = useT();
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
      <AdminTopBar title={tr("adminUsers.title")} subtitle={tr("adminUsers.subtitle", { all: counts.all, atRisk: counts.atRisk })} />

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
            placeholder={tr("adminUsers.searchPlaceholder")}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              fontFamily: FONT.medium,
              fontSize: 14.5,
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
        className="grow-0 shrink-0"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <FilterChip
          label={tr("adminUsers.filterAll")}
          count={counts.all}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterChip
          label="Pro"
          count={counts.Pro}
          active={filter === "Pro"}
          dot={colors.tagProText}
          onPress={() => setFilter("Pro")}
        />
        <FilterChip
          label="Free"
          count={counts.Free}
          active={filter === "Free"}
          dot={colors.archived}
          onPress={() => setFilter("Free")}
        />
        <FilterChip
          label={tr("adminUsers.filterAtRisk")}
          count={counts.atRisk}
          active={filter === "At risk"}
          dot={colors.fading}
          onPress={() => setFilter("At risk")}
        />
      </ScrollView>

      {/* List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 14.5,
              color: colors.midGrey,
              textAlign: "center",
              fontStyle: "italic",
              paddingVertical: 32,
            }}
          >
            Nessun utente trovato.
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
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={t("adminUsers.openDetailsA11y", { name: user.name })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.chip,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 15,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <InitialsAvatar initials={user.initials} size={40} variant="user" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: 15,
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
                fontSize: 10.5,
                color: tint.text,
                letterSpacing: 0.3,
              }}
            >
              {PLAN_LABEL[user.plan]}
            </Text>
          </View>
        </View>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 13,
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
              fontSize: 12.5,
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
            fontSize: 12,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {user.lastSeen}
        </Text>
      </View>
    </Tappable>
  );
}
