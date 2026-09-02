import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";

import { MascotLoader } from "@/components/MascotLoader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

/**
 * Landing route for the NON-recovery Supabase email links
 * (`memika://auth-callback#access_token=…&type=signup|magiclink|email_change`).
 *
 * Hosted Auth currently has email confirmation OFF, so nothing points here
 * today; it exists so that re-enabling confirmation never dumps a user on
 * an "Unmatched route" screen. Lives in the ROOT stack (like /choose-topic)
 * because it must render whether or not a session already exists.
 *
 * Recovery links never stop here: the root layout raises
 * `pendingPasswordReset` and opens /(auth)/reset-password instead.
 */
export default function AuthCallbackScreen() {
  const { t } = useT();
  const colors = useColors();
  const authLink = useAuthStore((s) => s.authLink);
  const pendingPasswordReset = useAuthStore((s) => s.pendingPasswordReset);
  const applyAuthLink = useAuthStore((s) => s.applyAuthLink);
  const endPasswordReset = useAuthStore((s) => s.endPasswordReset);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const consumedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (consumedRef.current || pendingPasswordReset) return undefined;
    if (authLink) {
      consumedRef.current = true;
      const isSignup = authLink.type === "signup";
      applyAuthLink(authLink).then((message) => {
        if (!mountedRef.current) return;
        endPasswordReset(); // drops the consumed link from memory
        if (message) {
          setError(message);
          return;
        }
        // A just-confirmed signup has no folder yet: the topic pick creates
        // it (and self-skips when one already exists).
        router.replace((isSignup ? "/choose-topic" : "/") as never);
      });
      return undefined;
    }
    // Same grace period as reset-password: the root layout stores the link
    // a tick after Expo Router navigates here by path.
    const timer = setTimeout(() => setTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, [authLink, pendingPasswordReset, applyAuthLink, endPasswordReset]);

  // Recovery link that happened to land on this path — the root layout
  // is already redirecting to the reset screen.
  if (pendingPasswordReset) return null;
  if (!hydrated) return null;
  if (timedOut && !authLink && !error) return <Redirect href="/" />;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 28 }}>
        {error ? (
          <View style={{ width: "100%", gap: 12 }}>
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 22,
                lineHeight: 28,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {t("authCallback.linkUnusableTitle")}
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
              }}
            >
              {error}
            </Text>
            <View style={{ marginTop: 16 }}>
              <PrimaryButton
                label={t("authCallback.goToSignIn")}
                onPress={() => router.replace("/(auth)/login")}
              />
            </View>
          </View>
        ) : (
          <MascotLoader label={t("authCallback.signingIn")} />
        )}
      </View>
    </SafeAreaView>
  );
}
