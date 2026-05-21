import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { ChevronLeft, Mail } from "lucide-react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { isDemoMode, supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { colors, FONT } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Inserisci la tua email.");
      return;
    }
    if (isDemoMode) {
      setError(
        "Demo mode attivo: l'invio email è disabilitato. In produzione riceverai un link via email.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // Always show the success view regardless of whether the email is
      // registered — this is the standard "no enumeration" UX. Errors that
      // are NOT enumeration leaks (network down, malformed input) still
      // surface so the user can retry.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );
      if (resetError && /network|fetch|timeout/i.test(resetError.message)) {
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
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Indietro"
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <ChevronLeft size={22} color={colors.navy} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Hero */}
          <View className="items-center" style={{ paddingTop: 16, paddingBottom: 36 }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 999,
                backgroundColor: colors.warmWhite,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
            >
              <Mail size={32} color={colors.navy} strokeWidth={1.75} />
            </View>
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
              Password dimenticata?
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
              Inserisci la tua email, ti invieremo un link per reimpostarla.
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
                Controlla la tua email
              </Text>
              <Text
                style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey, lineHeight: 20 }}
              >
                Se{" "}
                <Text style={{ fontFamily: FONT.semibold, color: colors.navy }}>
                  {email}
                </Text>{" "}
                corrisponde a un account, riceverai un link entro qualche minuto.
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
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                placeholder="tu@esempio.com"
                placeholderTextColor={colors.placeholder}
                className="rounded-input bg-surface px-4 text-body-lg text-navy"
                style={{
                  height: 56,
                  fontFamily: FONT.medium,
                  borderWidth: 1.5,
                  borderColor: focused ? colors.navy : colors.hairline,
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
                  label="Invia link di reset"
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
              Ricordi la password?{" "}
            </Text>
            <Link href={"/(auth)/login" as never} asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text
                  style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}
                >
                  Accedi
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
