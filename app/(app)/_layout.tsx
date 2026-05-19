import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Home, Folder, BarChart3, Settings as SettingsIcon } from "lucide-react-native";

import { useAuthGate } from "@/lib/auth-gate";
import { colors } from "@/theme/tokens";

export default function AppLayout() {
  const gate = useAuthGate("app");
  if (gate) return gate;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.midGrey,
        tabBarStyle: {
          // Translucent warm-white over a blur — matches the mockup's
          // "frosted iOS-style" bottom bar so content reads through at scroll edges.
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
          fontSize: 10.5,
          letterSpacing: 0.6,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: "Knowledge",
          tabBarIcon: ({ color }) => <Folder size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: "Progress",
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
