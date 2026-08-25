// DO NOT REMOVE — NativeWind v4 requires this import at the entry layout.
// Removing it silently breaks every `className` in the app.
import "../global.css";

import { useCallback, useEffect } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Stack,
  router,
  useNavigationContainerRef,
  usePathname,
  useRootNavigationState,
  type ErrorBoundaryProps,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { useAuthStore } from "@/lib/auth-store";
import { parseDevSignOutToken } from "@/lib/auth-links";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { reportError } from "@/lib/report-error";
import { useUIStore } from "@/lib/ui-store";
import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Toast } from "@/components/Toast";
import { FONT, colors } from "@/theme/tokens";

/**
 * Sentry — crash + error reporting for TestFlight / Play builds.
 *
 * Initialised at module scope so it runs BEFORE any rendering (uncaught JS
 * errors during the first render are captured too). Disabled entirely in
 * development and when EXPO_PUBLIC_SENTRY_DSN is empty, so a local build
 * without a DSN never phones home. Non-fatal errors reach it through
 * lib/report-error.ts; uncaught ones through the global handlers; route
 * render crashes through the ErrorBoundary below. See docs/DEPLOY.md § Sentry.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !__DEV__ && SENTRY_DSN.length > 0,
  environment: __DEV__ ? "development" : "production",
  // 20 % of navigations become performance traces — enough to spot slow
  // screens on the free tier without burning the quota.
  tracesSampleRate: 0.2,
  // No IP addresses, no device identifiers beyond what Sentry needs.
  sendDefaultPii: false,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),
});

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
/** `usePathname()` value of app/(auth)/reset-password.tsx (route groups are stripped). */
const RESET_PASSWORD_PATHNAME = "/reset-password";

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

/**
 * Branded crash screen for render errors anywhere in the route tree.
 *
 * Expo Router wraps every route (this layout included) in `<Try catch={…}>`
 * when the file exports `ErrorBoundary`. An error caught here never reaches
 * Sentry's global handler, so it is reported explicitly. `retry` clears the
 * boundary and re-renders the route — the store state survives, so a
 * transient failure (a bad network response mid-render) recovers in place.
 *
 * Rendered OUTSIDE SafeAreaProvider / fonts guard: keep it dependency-free.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // A crash during the very first render would otherwise leave the
    // native splash on screen forever.
    SplashScreen.hideAsync().catch(() => {});
    reportError("root/error-boundary", error);
  }, [error]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.warmWhite }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 28,
          paddingVertical: 32,
        }}
      >
        <Mascot variant="investigate" size={132} withShadow={false} />
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: FONT.bold,
            fontSize: 26,
            color: colors.navy,
            letterSpacing: -0.6,
            textAlign: "center",
            marginTop: 18,
          }}
        >
          Qualcosa è andato storto
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 15,
            lineHeight: 22,
            color: colors.midGrey,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Non è colpa tua. Riprova: se succede di nuovo, scrivici a {SUPPORT_EMAIL} e
          racconta cosa stavi facendo.
        </Text>
        {__DEV__ ? (
          <Text
            selectable
            style={{
              fontFamily: FONT.medium,
              fontSize: 12,
              lineHeight: 17,
              color: colors.danger,
              textAlign: "center",
              marginTop: 16,
            }}
          >
            {error.name}: {error.message}
          </Text>
        ) : null}
        <View style={{ alignSelf: "stretch", marginTop: 28 }}>
          <PrimaryButton
            label="Riprova"
            onPress={() => {
              retry().catch(() => {});
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RootLayout() {
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
  const pathname = usePathname();
  const navigationRef = useNavigationContainerRef();

  // Sentry navigation breadcrumbs + screen-load spans need the container.
  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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
        reportError("root/initial-url", err);
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
          reportError("root/auth-link", err);
        });
    });
    return () => sub.remove();
  }, [receiveAuthLink]);

  // Whenever a password recovery starts (deep link, or a PASSWORD_RECOVERY
  // event from Supabase), open the reset screen — regardless of where the
  // user was. Waits for the navigator so router.replace never fires before
  // the root layout mounted. Skipped when Expo Router already put the reset
  // screen on screen from the URL path (cold start, and usually warm start
  // too): a REPLACE onto the same route mints a NEW screen instance, which
  // would unmount the one that is exchanging the code and re-run it.
  useEffect(() => {
    if (!pendingPasswordReset || !hydrated || !navReady) return;
    if (pathname === RESET_PASSWORD_PATHNAME) return;
    router.replace("/(auth)/reset-password" as never);
  }, [pendingPasswordReset, hydrated, navReady, pathname]);

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
        reportError(
          "root/bootstrap-timeout",
          new Error(`auth hydrate did not finish within ${BOOTSTRAP_TIMEOUT_MS} ms — forcing hydrated=true`),
        );
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

// Sentry.wrap adds the touch-event breadcrumb boundary and the React
// profiler around the root — it is NOT an error boundary (that is the
// named export above).
export default Sentry.wrap(RootLayout);
