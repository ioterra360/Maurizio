// DO NOT REMOVE — NativeWind v4 requires this import at the entry layout.
// Removing it silently breaks every `className` in the app.
import "../global.css";

import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { useAuthStore } from "@/lib/auth-store";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 220 });

/**
 * Bootstrap-timeout safety net — if hydrate or font loading hangs (e.g. a
 * dropped Supabase connection on cold start), we still surface the app
 * after this many ms rather than leaving the user on the splash forever.
 *
 * Borrowed from the TLC mobile pattern (15 s bootstrap timeout).
 */
const BOOTSTRAP_TIMEOUT_MS = 15_000;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const subscribeAuthChanges = useAuthStore((s) => s.subscribeAuthChanges);

  // Kick off auth hydration on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Listen to Supabase auth state changes (token refresh / global sign-out)
  // for the lifetime of the app.
  useEffect(() => {
    return subscribeAuthChanges();
  }, [subscribeAuthChanges]);

  // Bootstrap timeout — force-hydrate after the deadline so a dead network
  // can't lock us on the splash.
  useEffect(() => {
    if (hydrated) return;
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().hydrated) {
        if (__DEV__) console.warn("[Memora] bootstrap timeout — forcing hydrated=true");
        useAuthStore.setState({ hydrated: true });
      }
    }, BOOTSTRAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hydrated]);

  // Hide the splash AFTER the first real frame has laid out — avoids the
  // brief "no-content flash" between `return null` and the tree mounting.
  const onRootLayout = useCallback(() => {
    if ((fontsLoaded || fontError) && hydrated) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, hydrated]);

  if (!(fontsLoaded || fontError) || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }} onLayout={onRootLayout}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
