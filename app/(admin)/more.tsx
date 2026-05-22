import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Activity,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Server,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";

import { AdminTopBar } from "@/components/AdminTopBar";
import { SectionLabel } from "@/components/SectionLabel";
import { InitialsAvatar } from "@/components/FolderTile";
import { useAuthStore } from "@/lib/auth-store";
import { FONT, colors } from "@/theme/tokens";

type Sub = {
  icon: LucideIcon;
  label: string;
  hint: string;
  badge?: number;
  onPress?: () => void;
};

export default function AdminMoreScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const operations: Sub[] = [
    { icon: FileText, label: "Content templates", hint: "6 published · 2 drafts" },
    { icon: Bell, label: "Notifications", hint: "Broadcasts · campaign scheduling" },
    { icon: Server, label: "System health", hint: "1 service degraded", badge: 1 },
  ];

  const workspace: Sub[] = [
    { icon: UsersIcon, label: "Team", hint: "5 members · 1 owner" },
    { icon: CreditCard, label: "Billing", hint: "Growth plan · $349/mo" },
    { icon: Activity, label: "API keys", hint: "2 active · last used 3h ago" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar title="More" subtitle="Operations · workspace · account" />

        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <SectionLabel>Operations</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {operations.map((s) => (
            <SubRow key={s.label} sub={s} />
          ))}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 }}>
          <SectionLabel>Workspace</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {workspace.map((s) => (
            <SubRow key={s.label} sub={s} />
          ))}
        </View>

        {/* Account card */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>Account</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.hairline,
              gap: 12,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <InitialsAvatar
                initials={(user?.name ?? "M")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("")}
                size={42}
                variant="admin"
              />
              <View style={{ flex: 1 }}>
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: FONT.semibold,
                      fontSize: 15,
                      color: colors.navy,
                      letterSpacing: -0.1,
                    }}
                  >
                    {user?.name ?? "Admin"}
                  </Text>
                  <View
                    className="rounded-tag"
                    style={{ backgroundColor: colors.tagUserBg, paddingHorizontal: 6, paddingVertical: 1 }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.bold,
                        fontSize: 10,
                        color: colors.navy,
                        letterSpacing: 0.7,
                      }}
                    >
                      OWNER
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 12,
                    color: colors.midGrey,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              className="items-center justify-center rounded-chip"
              style={({ pressed }) => ({
                height: 40,
                borderWidth: 1,
                borderColor: colors.hairlineStrong,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 13,
                  color: colors.navy,
                  letterSpacing: -0.05,
                }}
              >
                Sign out
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SubRow({ sub }: { sub: Sub }) {
  const Icon = sub.icon;
  return (
    <Pressable
      onPress={sub.onPress}
      accessibilityRole="button"
      accessibilityLabel={sub.label}
      className="flex-row items-center rounded-chip bg-surface"
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: colors.tagUserBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={colors.navy} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 13.5,
            color: colors.navy,
            letterSpacing: -0.05,
          }}
        >
          {sub.label}
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 12,
            color: colors.midGrey,
            marginTop: 1,
          }}
        >
          {sub.hint}
        </Text>
      </View>
      {sub.badge ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.fading,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 11.5,
              color: colors.navy,
              fontVariant: ["tabular-nums"],
            }}
          >
            {sub.badge}
          </Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.placeholder} strokeWidth={1.8} />
    </Pressable>
  );
}
