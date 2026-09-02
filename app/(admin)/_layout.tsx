import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  BarChart3,
  Home,
  MoreHorizontal,
  ShieldAlert,
  Users,
} from "lucide-react-native";

import { useAuthGate } from "@/lib/auth-gate";
import { useColors } from "@/theme/tokens";
import { useThemeStore } from "@/theme/theme-store";
import { useT } from "@/lib/i18n";

export default function AdminLayout() {
  const { t } = useT();
  const gate = useAuthGate("admin");
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const scheme = useThemeStore((s) => s.scheme);
  if (gate) return gate;

  const barPaddingBottom = Math.max(insets.bottom, 22);
  const barHeight = 10 + 44 + barPaddingBottom;
  const barBg = scheme === "dark" ? "rgba(14,16,21,0.92)" : "rgba(250,248,244,0.92)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.midGrey,
        tabBarStyle: {
          backgroundColor: barBg,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: 10,
          paddingBottom: barPaddingBottom,
          position: "absolute",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={40}
            tint={scheme === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10.5,
          letterSpacing: -0.05,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("adminTabs.home"),
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: t("adminTabs.users"),
          tabBarIcon: ({ color }) => <Users size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="moderation"
        options={{
          title: t("adminTabs.moderation"),
          tabBarIcon: ({ color }) => <ShieldAlert size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("adminTabs.insights"),
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("adminTabs.more"),
          tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
