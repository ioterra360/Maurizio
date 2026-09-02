import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import * as Linking from "expo-linking";
import { ChevronLeft } from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { AuthTextInput } from "@/components/AuthTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Tappable } from "@/components/Tappable";
import { isDemoMode, supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_LINK_PATHS } from "@/lib/auth-links";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const { t } = useT();
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t("forgotPassword.enterEmail"));
      return;
    }
    if (isDemoMode) {
      setError(t("forgotPassword.demoModeDisabled"));
      return;
    }
    setSubmitting(true);
    try {
      // No-enumeration UX is enforced by Supabase server-side: /recover
      // returns success for unknown emails, so any error that does come
      // back (rate limit, malformed email, SMTP) is genuine and must
      // surface instead of faking a "sent" confirmation.
      // redirectTo MUST be on the hosted Auth allow-list (memika://**,
      // exp://** — see docs/DEPLOY.md). createURL yields memika://reset-password
      // in a build and exp://<lan-ip>:<port>/--/reset-password in Expo Go;
      // the link lands in app/(auth)/reset-password.tsx via the root layout.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: Linking.createURL(AUTH_LINK_PATHS.resetPassword) },
      );
      if (resetError) {
        setError(authErrorMessage(resetError));
        return;
      }
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // The catalog keeps `{email}` inside the sentence so each language can
  // place it naturally; split around it to render the address in semibold.
  const [sentBodyBefore, sentBodyAfter] = t("forgotPassword.sentBody").split("{email}");

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 28,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <View style={{ paddingTop: 8 }}>
            <Tappable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              hitSlop={10}
              pressedOpacity={0.6}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
            </Tappable>
          </View>

          {/* Hero — investigate mascot illustrates "looking for your password" */}
          <View className="items-center" style={{ paddingTop: 12, paddingBottom: 30 }}>
            <Mascot variant="investigate" size={92} withShadow={false} />
            <Text
              style={{
                marginTop: 22,
                fontFamily: FONT.bold,
                fontSize: 26,
                lineHeight: 32,
                letterSpacing: -0.4,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              {t("forgotPassword.title")}
            </Text>
            <Text
              style={{
                marginTop: 10,
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
                paddingHorizontal: 12,
              }}
            >
              {t("forgotPassword.subtitle")}
            </Text>
          </View>

          {sent ? (
            <View
              style={{
                padding: 18,
                borderRadius: 14,
                backgroundColor: colors.warmWhite,
                borderWidth: 1,
                borderColor: colors.hairline,
                gap: 8,
                shadowColor: colors.navy,
                shadowOpacity: 0.06,
                shadowOffset: { width: 0, height: 6 },
                shadowRadius: 18,
                elevation: 2,
              }}
            >
              <Text
                style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy }}
              >
                {t("forgotPassword.checkEmailTitle")}
              </Text>
              <Text
                style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey, lineHeight: 20 }}
              >
                {sentBodyBefore}
                <Text style={{ fontFamily: FONT.semibold, color: colors.navy }}>
                  {email}
                </Text>
                {sentBodyAfter}
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={{
                  marginBottom: 8,
                  fontFamily: FONT.semibold,
                  fontSize: 11,
                  letterSpacing: 1.3,
                  textTransform: "uppercase",
                  color: colors.midGrey,
                }}
              >
                {t("forgotPassword.emailLabel")}
              </Text>
              <AuthTextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                placeholder={t("forgotPassword.emailPlaceholder")}
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (!submitting) void handleSubmit();
                }}
              />

              {error ? (
                <View
                  className="mt-4 self-start rounded-chip px-3 py-2"
                  style={{ backgroundColor: colors.dangerSoft }}
                >
                  <Text
                    style={{ fontFamily: FONT.medium, fontSize: 12.5, color: colors.danger }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 28 }}>
                <PrimaryButton
                  label={t("forgotPassword.sendResetLink")}
                  loading={submitting}
                  onPress={handleSubmit}
                />
              </View>
            </>
          )}

          {/* Footer */}
          <View
            style={{
              marginTop: 28,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontFamily: FONT.regular, fontSize: 14, color: colors.midGrey }}
            >
              {t("forgotPassword.rememberPassword")}{" "}
            </Text>
            <Link href={"/(auth)/login" as never} asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text
                  style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}
                >
                  {t("forgotPassword.signInLink")}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
