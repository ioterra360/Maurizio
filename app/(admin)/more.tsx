import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Activity,
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Server,
  Smartphone,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";

import { AdminTopBar } from "@/components/AdminTopBar";
import { SectionLabel } from "@/components/SectionLabel";
import { InitialsAvatar } from "@/components/FolderTile";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";

type Sub = {
  id: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  badge?: number;
  onPress?: () => void;
};

export default function AdminMoreScreen() {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setViewAsUser = useAuthStore((s) => s.setViewAsUser);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  // Lets the (single) admin see the consumer surface with their own
  // account. The flag must be raised BEFORE navigating: the (app) gate reads
  // it synchronously and would otherwise bounce straight back here.
  const openAsUser = () => {
    setViewAsUser(true);
    router.replace("/(app)/today");
  };

  const account: Sub[] = [
    {
      id: "openAsUser",
      icon: Smartphone,
      label: t("adminMore.openAsUserLabel"),
      hint: t("adminMore.openAsUserHint"),
      onPress: openAsUser,
    },
  ];

  const operations: Sub[] = [
    {
      id: "contentTemplates",
      icon: FileText,
      label: t("adminMore.contentTemplatesLabel"),
      hint: t("adminMore.contentTemplatesHint"),
    },
    {
      id: "notifications",
      icon: Bell,
      label: t("adminMore.notificationsLabel"),
      hint: t("adminMore.notificationsHint"),
    },
    {
      id: "systemStatus",
      icon: Server,
      label: t("adminMore.systemStatusLabel"),
      hint: t("adminMore.systemStatusHint"),
      badge: 1,
    },
  ];

  const workspace: Sub[] = [
    {
      id: "team",
      icon: UsersIcon,
      label: t("adminMore.teamLabel"),
      hint: t("adminMore.teamHint"),
    },
    {
      id: "billing",
      icon: CreditCard,
      label: t("adminMore.billingLabel"),
      hint: t("adminMore.billingHint"),
    },
    {
      id: "apiKeys",
      icon: Activity,
      label: t("adminMore.apiKeysLabel"),
      hint: t("adminMore.apiKeysHint"),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar title={t("adminMore.title")} subtitle={t("adminMore.subtitle")} />

        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <SectionLabel>{t("adminMore.operationsSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {operations.map((s) => (
            <SubRow key={s.id} sub={s} />
          ))}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 }}>
          <SectionLabel>{t("adminMore.workspaceSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {workspace.map((s) => (
            <SubRow key={s.id} sub={s} />
          ))}
        </View>

        {/* Account card */}
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>
          <SectionLabel>{t("adminMore.accountSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {account.map((s) => (
            <SubRow key={s.id} sub={s} />
          ))}
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
                initials={(user?.name ?? t("adminMore.avatarInitialsFallback"))
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
                      fontSize: 16,
                      color: colors.navy,
                      letterSpacing: -0.1,
                    }}
                  >
                    {user?.name ?? t("adminMore.adminFallbackName")}
                  </Text>
                  <View
                    className="rounded-tag"
                    style={{ backgroundColor: colors.tagUserBg, paddingHorizontal: 6, paddingVertical: 1 }}
                  >
                    <Text
                      style={{
                        fontFamily: FONT.bold,
                        fontSize: 11,
                        color: colors.navy,
                        letterSpacing: 0.7,
                      }}
                    >
                      {t("adminMore.ownerBadge")}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 13.5,
                    color: colors.midGrey,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {user?.email ?? ""}
                </Text>
              </View>
            </View>
            <Tappable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel={t("adminMore.signOut")}
              pressedOpacity={0.7}
              style={{
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.chip,
                height: 40,
                borderWidth: 1,
                borderColor: colors.hairlineStrong,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 14.5,
                  color: colors.navy,
                  letterSpacing: -0.05,
                }}
              >
                {t("adminMore.signOut")}
              </Text>
            </Tappable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SubRow({ sub }: { sub: Sub }) {
  const Icon = sub.icon;
  return (
    <Tappable
      onPress={sub.onPress}
      accessibilityRole="button"
      accessibilityLabel={sub.label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.chip,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
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
            fontSize: 14.5,
            color: colors.navy,
            letterSpacing: -0.05,
          }}
        >
          {sub.label}
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 13.5,
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
              fontSize: 13,
              color: colors.navy,
              fontVariant: ["tabular-nums"],
            }}
          >
            {sub.badge}
          </Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.placeholder} strokeWidth={1.8} />
    </Tappable>
  );
}
