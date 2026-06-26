import { ScrollView, Text, View } from "react-native";
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
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";

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
    { icon: FileText, label: "Template contenuti", hint: "6 pubblicati · 2 bozze" },
    { icon: Bell, label: "Notifiche", hint: "Broadcast · pianificazione campagne" },
    { icon: Server, label: "Stato del sistema", hint: "1 servizio degradato", badge: 1 },
  ];

  const workspace: Sub[] = [
    { icon: UsersIcon, label: "Team", hint: "5 membri · 1 owner" },
    { icon: CreditCard, label: "Fatturazione", hint: "Piano Growth · €349/mese" },
    { icon: Activity, label: "Chiavi API", hint: "2 attive · ultimo uso 3h fa" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <AdminTopBar title="Altro" subtitle="Operazioni · spazio di lavoro · account" />

        <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          <SectionLabel>Operazioni</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {operations.map((s) => (
            <SubRow key={s.label} sub={s} />
          ))}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 }}>
          <SectionLabel>Spazio di lavoro</SectionLabel>
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
                      fontSize: 16,
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
                        fontSize: 11,
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
              accessibilityLabel="Esci"
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
                Esci
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
