import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Home, Folder, BarChart3, Settings as SettingsIcon } from "lucide-react-native";

import { useAuthGate } from "@/lib/auth-gate";
import { colors } from "@/theme/tokens";

export default function AppLayout() {
  const gate = useAuthGate("app");
  const insets = useSafeAreaInsets();
  if (gate) return gate;

  // Mockup-faithful bar: paddingTop 10 + content (~44) + paddingBottom 22,
  // with the safe-area bottom inset added on top so the home indicator
  // doesn't overlap the labels on notched devices.
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
          fontSize: 11,
          letterSpacing: -0.05,
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
