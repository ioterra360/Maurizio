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
import { colors } from "@/theme/tokens";

export default function AdminLayout() {
  const gate = useAuthGate("admin");
  const insets = useSafeAreaInsets();
  if (gate) return gate;

  const barPaddingBottom = Math.max(insets.bottom, 22);
  const barHeight = 10 + 44 + barPaddingBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.midGrey,
        tabBarStyle: {
          backgroundColor: "rgba(250,248,244,0.92)",
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: 10,
          paddingBottom: barPaddingBottom,
          position: "absolute",
        },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
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
          title: "Home",
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Utenti",
          tabBarIcon: ({ color }) => <Users size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="moderation"
        options={{
          title: "Moderazione",
          tabBarIcon: ({ color }) => <ShieldAlert size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insight",
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Altro",
          tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
