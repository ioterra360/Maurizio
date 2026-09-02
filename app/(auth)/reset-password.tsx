import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { AuthTextInput } from "@/components/AuthTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuthStore } from "@/lib/auth-store";
import { authErrorMessage } from "@/lib/auth-errors";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { FONT, useColors } from "@/theme/tokens";

const MIN_PASSWORD_LENGTH = 8;

type LinkStatus = "verifying" | "ready" | "invalid";

/**
 * "Nuova password" — the landing screen of the recovery email
 * (`memika://reset-password?code=…`, PKCE).
 *
 * How the pieces fit:
 *   1. app/_layout.tsx receives the URL and stores it in the auth store
 *      (`authLink`) with `pendingPasswordReset = true` — that flag is what
 *      keeps the (auth) gate from bouncing us to Today once the tokens turn
 *      into a session.
 *   2. This screen exchanges the link for a session (`applyAuthLink`), then
 *      asks for the new password and calls `updateUser({ password })`.
 *   3. On success the flag is cleared and `/` routes by role as usual.
 *
 * Reached by hand (no link, no session): explains that the link from the
 * email is needed and offers to request one.
 */
export default function ResetPasswordScreen() {
  const { t } = useT();
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const authLink = useAuthStore((s) => s.authLink);
  const pendingPasswordReset = useAuthStore((s) => s.pendingPasswordReset);
  const applyAuthLink = useAuthStore((s) => s.applyAuthLink);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const endPasswordReset = useAuthStore((s) => s.endPasswordReset);
  const signOut = useAuthStore((s) => s.signOut);
  const showToast = useUIStore((s) => s.showToast);

  const [status, setStatus] = useState<LinkStatus>("verifying");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<TextInput>(null);
  // The link is consumed exactly once even if the store re-renders us.
  const consumedRef = useRef(false);
  // applyAuthLink flips `user` (a dependency below) BEFORE it resolves, so
  // the cancellation guard must track unmount only — not effect re-runs.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (consumedRef.current) return undefined;
    if (authLink) {
      consumedRef.current = true;
      applyAuthLink(authLink).then((message) => {
        if (!mountedRef.current) return;
        if (message) {
          setLinkError(message);
          setStatus("invalid");
        } else {
          setStatus("ready");
        }
      });
      return undefined;
    }
    // No link in memory: either a PASSWORD_RECOVERY event already created
    // the session (flag up, user set) or someone navigated here by hand.
    if (user && pendingPasswordReset) {
      consumedRef.current = true;
      setStatus("ready");
      return undefined;
    }
    // Expo Router navigates here by PATH as soon as the OS hands over the
    // URL, while the root layout stores the link a tick later (async
    // dedupe). Give it a moment before declaring the visit link-less.
    const timer = setTimeout(() => {
      setLinkError(t("resetPassword.openEmailLink"));
      setStatus("invalid");
    }, 1500);
    return () => clearTimeout(timer);
  }, [authLink, user, pendingPasswordReset, applyAuthLink, t]);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("resetPassword.passwordTooShort", { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.passwordsDontMatch"));
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      endPasswordReset();
      showToast(t("resetPassword.passwordUpdatedToast"));
      // `/` redirects by role (user → Today, admin → admin home).
      router.replace("/");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Abandoning the reset: the recovery link created a real session, so
  // leaving it alive would silently log the user in without a new password.
  // Local scope: only THIS recovery session dies — the user's other devices
  // stay signed in (they never asked to be logged out everywhere).
  const handleCancel = async () => {
    endPasswordReset();
    await signOut({ scope: "local" });
    router.replace("/(auth)/login" as never);
  };

  const requestNewLink = () => {
    endPasswordReset();
    router.replace("/(auth)/forgot-password" as never);
  };

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
          {/* Hero */}
          <View className="items-center" style={{ paddingTop: 36, paddingBottom: 30 }}>
            <Mascot variant="checklist" size={92} withShadow={false} />
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
              {t("resetPassword.title")}
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
              {status === "ready"
                ? user?.email
                  ? t("resetPassword.chooseWithEmail", {
                      count: MIN_PASSWORD_LENGTH,
                      email: user.email,
                    })
                  : t("resetPassword.chooseNoEmail", { count: MIN_PASSWORD_LENGTH })
                : t("resetPassword.verifyingLink")}
            </Text>
          </View>

          {status === "verifying" ? (
            <View className="items-center" style={{ paddingTop: 12 }}>
              <MascotLoader label={t("resetPassword.verifyingLoader")} />
            </View>
          ) : null}

          {status === "invalid" ? (
            <>
              <View
                style={{
                  padding: 18,
                  borderRadius: 14,
                  backgroundColor: colors.warmWhite,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  gap: 8,
                }}
              >
                <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy }}>
                  {t("resetPassword.linkUnusableTitle")}
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 13.5,
                    color: colors.midGrey,
                    lineHeight: 20,
                  }}
                >
                  {linkError}
                </Text>
              </View>
              <View style={{ marginTop: 28, gap: 12 }}>
                <PrimaryButton label={t("resetPassword.requestNewLink")} onPress={requestNewLink} />
                <PrimaryButton
                  label={t("resetPassword.backToSignIn")}
                  variant="outline"
                  onPress={() => {
                    void handleCancel();
                  }}
                />
              </View>
            </>
          ) : null}

          {status === "ready" ? (
            <>
              <FieldLabel>{t("resetPassword.newPasswordLabel")}</FieldLabel>
              <AuthTextInput
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
                secureTextEntry
                placeholder={t("resetPassword.passwordPlaceholder", { count: MIN_PASSWORD_LENGTH })}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />

              <FieldLabel style={{ marginTop: 18 }}>{t("resetPassword.confirmPasswordLabel")}</FieldLabel>
              <AuthTextInput
                ref={confirmRef}
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
                secureTextEntry
                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                returnKeyType="done"
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

              <View style={{ marginTop: 28, gap: 12 }}>
                <PrimaryButton
                  label={t("resetPassword.saveNewPassword")}
                  loading={submitting}
                  onPress={handleSubmit}
                />
                <PrimaryButton
                  label={t("common.cancel")}
                  variant="outline"
                  disabled={submitting}
                  onPress={() => {
                    void handleCancel();
                  }}
                />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: { marginTop?: number };
}) {
  const colors = useColors();
  return (
    <Text
      style={{
        marginBottom: 8,
        fontFamily: FONT.semibold,
        fontSize: 11,
        letterSpacing: 1.3,
        textTransform: "uppercase",
        color: colors.midGrey,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}
