// DO NOT REMOVE — NativeWind v4 requires this import at the entry layout.
// Removing it silently breaks every `className` in the app.
import "../global.css";

import { useCallback, useEffect } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { Toast } from "@/components/Toast";
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

/**
 * AsyncStorage key for the last consumed reset token. Reset deep-links use the
 * shape `?reset=<token>` (e.g. `?reset=1`); when we see one, we sign out only
 * if its token differs from the stored one, then persist the new token. This
 * makes Expo Go bundle reloads (which keep firing the same initial URL) a
 * no-op after the first apply, so refreshing no longer kicks the user back
 * to login on every fast-reload.
 */
const RESET_TOKEN_KEY = "memora.reset-token";

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

  // Kick off auth hydration on mount. If the deep-link URL the app was
  // opened with carries `?reset=1` (the QR points here in DEV so testers
  // always land on the login screen), wipe any persisted session FIRST
  // so the auth gate sees user=null and routes to /login.
  useEffect(() => {
    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          // Regex over the raw URL is more robust than Linking.parse on the
          // shapes Expo Go produces (exp://host:port/--/?reset=<token> has
          // empty path which Linking.parse doesn't always pick query params
          // from).
          const m = initialUrl.match(/[?&]reset=([^&#]+)/);
          if (m) {
            const token = decodeURIComponent(m[1]);
            const lastSeen = await AsyncStorage.getItem(RESET_TOKEN_KEY).catch(() => null);
            if (token !== lastSeen) {
              if (__DEV__) console.log(`[Memora] reset=${token} deep-link — signing out (new token)`);
              await useAuthStore.getState().signOut();
              await AsyncStorage.setItem(RESET_TOKEN_KEY, token).catch(() => {});
            } else if (__DEV__) {
              console.log(`[Memora] reset=${token} deep-link — already consumed, skipping`);
            }
          }
        }
      } catch (err) {
        if (__DEV__) console.warn("[Memora] reset-via-deeplink check failed", err);
      }
      hydrate();
    })();
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
          >
            <Stack.Screen
              name="add"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
                contentStyle: { backgroundColor: colors.warmWhite },
              }}
            />
          </Stack>
          <GlobalToast />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Lifted toast so it survives `router.back()` from screens like Add — the
 * Toast subscribes to the global ui-store and renders above every route.
 */
function GlobalToast() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  return <Toast message={toast} onDismiss={hideToast} />;
}
