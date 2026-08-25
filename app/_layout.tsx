// DO NOT REMOVE — NativeWind v4 requires this import at the entry layout.
// Removing it silently breaks every `className` in the app.
import "../global.css";

import { useCallback, useEffect } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, router, useRootNavigationState } from "expo-router";
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
import { parseDevSignOutToken } from "@/lib/auth-links";
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
 * DEV ONLY — "sign out on open" deep link for testers.
 *
 * The Expo Go QR / bookmark can carry `?dev-signout=<token>` (legacy alias
 * `?reset=<token>`, kept so existing QR codes keep working). When the app is
 * opened with one, we sign out ONCE per distinct token so the tester lands
 * on the login screen; the token is remembered under this key so Expo Go
 * bundle reloads (which re-deliver the same initial URL) don't sign out
 * again. Compiled out of release builds via `__DEV__`.
 *
 * Not to be confused with the REAL password-reset link
 * (`memika://reset-password#access_token=…`) which is handled by
 * `useAuthStore().receiveAuthLink` below.
 */
const DEV_SIGNOUT_TOKEN_KEY = "memika.dev-signout-token";

async function handleDevSignOutLink(url: string): Promise<void> {
  if (!__DEV__) return;
  const token = parseDevSignOutToken(url);
  if (!token) return;
  const lastSeen = await AsyncStorage.getItem(DEV_SIGNOUT_TOKEN_KEY).catch(() => null);
  if (token === lastSeen) {
    console.log(`[Memika] dev-signout=${token} already consumed, skipping`);
    return;
  }
  console.log(`[Memika] dev-signout=${token} — signing out (new token)`);
  await useAuthStore.getState().signOut();
  await AsyncStorage.setItem(DEV_SIGNOUT_TOKEN_KEY, token).catch(() => {});
}

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
  const receiveAuthLink = useAuthStore((s) => s.receiveAuthLink);
  const pendingPasswordReset = useAuthStore((s) => s.pendingPasswordReset);
  const navigationState = useRootNavigationState();
  const navReady = Boolean(navigationState?.key);

  // Kick off auth hydration on mount. The URL the app was opened with is
  // inspected FIRST, before the navigator mounts, so that:
  //   - a DEV `?dev-signout=` link wipes the persisted session and the gate
  //     sees user=null;
  //   - a Supabase auth link (memika://reset-password#…, auth-callback#…)
  //     raises `pendingPasswordReset` / stores the link BEFORE the (auth)
  //     gate can render — the recovery tokens create a real session, and
  //     the flag is what stops the gate from bouncing the user to Today.
  useEffect(() => {
    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await handleDevSignOutLink(initialUrl);
          const outcome = await receiveAuthLink(initialUrl);
          if (__DEV__ && outcome !== "ignored") {
            console.log(`[Memika] initial auth link: ${outcome}`);
          }
        }
      } catch (err) {
        if (__DEV__) console.warn("[Memika] initial-URL check failed", err);
      }
      hydrate();
    })();
  }, [hydrate, receiveAuthLink]);

  // Warm-start links (app already open, user taps the email link).
  // Expo Router navigates to the matching route by path on its own; we only
  // need to capture the fragment tokens it drops.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      receiveAuthLink(url)
        .then((outcome) => {
          if (__DEV__ && outcome !== "ignored") console.log(`[Memika] auth link: ${outcome}`);
        })
        .catch((err) => {
          if (__DEV__) console.warn("[Memika] auth link handling failed", err);
        });
    });
    return () => sub.remove();
  }, [receiveAuthLink]);

  // Whenever a password recovery starts (deep link, or a PASSWORD_RECOVERY
  // event from Supabase), open the reset screen — regardless of where the
  // user was. Waits for the navigator so router.replace never fires before
  // the root layout mounted.
  useEffect(() => {
    if (!pendingPasswordReset || !hydrated || !navReady) return;
    router.replace("/(auth)/reset-password" as never);
  }, [pendingPasswordReset, hydrated, navReady]);

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
        if (__DEV__) console.warn("[Memika] bootstrap timeout — forcing hydrated=true");
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
                // Native modal only on iOS (card sheet). On Android the
                // native modal wrapper reports a zero top safe-area inset,
                // which slid the Add top bar under the status bar — the
                // "Salva a metà" clip. A card with the same slide-from-bottom
                // animation looks identical on Android and insets correctly.
                presentation: Platform.OS === "ios" ? "modal" : "card",
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
  return <Toast message={toast?.message ?? null} nonce={toast?.id} onDismiss={hideToast} />;
}
