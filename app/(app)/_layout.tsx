import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Home, Folder, BarChart3, Settings as SettingsIcon } from "lucide-react-native";

import { useAuthGate } from "@/lib/auth-gate";
import { fetchDeletionRequestedAt } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { reportError } from "@/lib/report-error";
import { useFolderOrderStore } from "@/lib/folder-order-store";
import { useFolderSortStore } from "@/lib/folder-sort-store";
import { useT } from "@/lib/i18n";
import { colors } from "@/theme/tokens";

export default function AppLayout() {
  const gate = useAuthGate("app");
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // Hydrate the persisted folder order once for every (app) surface, so
  // folder detail (and anything else reading priorities) doesn't depend on
  // Knowledge having mounted first.
  const orderHydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  useEffect(() => {
    if (!orderHydrated) void hydrateOrder();
  }, [orderHydrated, hydrateOrder]);
  const sortHydrated = useFolderSortStore((s) => s.hydrated);
  const hydrateSort = useFolderSortStore((s) => s.hydrate);
  useEffect(() => {
    if (!sortHydrated) void hydrateSort();
  }, [sortHydrated, hydrateSort]);
  // Eliminazione account richiesta (72h di grazia)? Fuori dall'app, sulla
  // schermata di recupero. Controllo una volta per utente a ogni mount del
  // gruppo (login incluso); un errore di rete non blocca l'uso normale.
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchDeletionRequestedAt(userId)
      .then((ts) => {
        if (!cancelled && ts) router.replace("/recover-account" as never);
      })
      .catch((err) => {
        reportError("app-layout/deletion-check", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  if (gate) return gate;

  // Mockup-faithful bar: paddingTop 10 + content (~44) + paddingBottom 22,
  // with the safe-area bottom inset added on top so the home indicator
  // doesn't overlap the labels on notched devices.
  const barPaddingBottom = Math.max(insets.bottom, 22);
  const barHeight = 10 + 44 + barPaddingBottom;

  return (
    <Tabs
      // Back from a pushed hidden tab (folder detail) must return to the tab
      // the user came from — the default backBehavior ("firstRoute") dumped
      // them on Oggi instead of Cartelle.
      backBehavior="history"
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
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t("tabs.today"),
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: t("tabs.folders"),
          tabBarIcon: ({ color }) => <Folder size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("tabs.progress"),
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} strokeWidth={1.75} />,
        }}
      />
      {/* Folder detail is reached by pushing /folder/[id] from Knowledge,
          not by tapping a tab. Hide it from the tab bar — without this,
          Expo Router would auto-mount it as a 5th, empty-titled tab. */}
      <Tabs.Screen name="folder/[id]" options={{ href: null }} />
    </Tabs>
  );
}
