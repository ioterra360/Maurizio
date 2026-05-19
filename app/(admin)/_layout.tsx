import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
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
  if (gate) return gate;

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
          height: 84,
          paddingTop: 10,
          paddingBottom: 24,
          position: "absolute",
        },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.5,
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
          title: "Users",
          tabBarIcon: ({ color }) => <Users size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="moderation"
        options={{
          title: "Moderation",
          tabBarIcon: ({ color }) => <ShieldAlert size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
