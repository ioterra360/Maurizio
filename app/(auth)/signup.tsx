import { useRef, useState } from "react";
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
import * as Linking from "expo-linking";
import { ChevronLeft, CheckCircle2 } from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { AuthTextInput } from "@/components/AuthTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Tappable } from "@/components/Tappable";
import { isDemoMode, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/auth-store";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_LINK_PATHS } from "@/lib/auth-links";
import { colors, FONT } from "@/theme/tokens";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Inserisci il tuo nome.");
      return;
    }
    if (!email.trim()) {
      setError("Inserisci la tua email.");
      return;
    }
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }
    if (isDemoMode) {
      setError(
        "Demo mode attivo: la registrazione reale è disabilitata. Usa gli account demo nella pagina di accesso.",
      );
      return;
    }
    setSubmitting(true);
    // Set BEFORE the await: supabase-js notifies SIGNED_IN listeners inside
    // signUp, so the auth gate would otherwise redirect to Today before the
    // onboarding replace below ever runs.
    useAuthStore.getState().setPendingOnboarding(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
          // Hosted Auth runs with email confirmation OFF (mailer_autoconfirm),
          // so no email is sent today. If confirmation is ever re-enabled the
          // link must come back INTO the app: app/auth-callback.tsx finishes
          // the session and routes to the topic pick.
          emailRedirectTo: Linking.createURL(AUTH_LINK_PATHS.authCallback),
        },
      });
      if (signUpError) {
        useAuthStore.getState().setPendingOnboarding(false);
        setError(authErrorMessage(signUpError));
        return;
      }
      if (!data.session) {
        // Confirmation required server-side: there is no session yet, so
        // onboarding (which creates the folder) cannot run. Be honest
        // instead of dropping the user into a broken carousel.
        useAuthStore.getState().setPendingOnboarding(false);
        setError(
          "Ti abbiamo inviato un'email: apri il link per confermare l'account, poi accedi.",
        );
        return;
      }
      router.replace("/(auth)/onboarding" as never);
    } catch (e) {
      useAuthStore.getState().setPendingOnboarding(false);
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
            <Tappable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Indietro"
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

          {/* Hero */}
          <View className="items-center" style={{ paddingTop: 8, paddingBottom: 24 }}>
            <Mascot variant="checklist" size={92} withShadow={false} />
            <Text
              style={{
                marginTop: 18,
                fontFamily: FONT.bold,
                fontSize: 26,
                lineHeight: 32,
                letterSpacing: -0.4,
                color: colors.navy,
                textAlign: "center",
              }}
            >
              Crea il tuo account
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
                paddingHorizontal: 18,
              }}
            >
              Cominciamo a prendere cura della tua memoria, un ricordo alla volta.
            </Text>
          </View>

          <FieldLabel>Nome</FieldLabel>
          <AuthTextInput
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Il tuo nome"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          <FieldLabel style={{ marginTop: 18 }}>Email</FieldLabel>
          <AuthTextInput
            ref={emailRef}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="tu@esempio.com"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <FieldLabel style={{ marginTop: 18 }}>Password</FieldLabel>
          <AuthTextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
            secureTextEntry
            placeholder="Almeno 8 caratteri"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />

          <FieldLabel style={{ marginTop: 18 }}>Conferma password</FieldLabel>
          <AuthTextInput
            ref={confirmRef}
            value={confirm}
            onChangeText={setConfirm}
            autoComplete="new-password"
            secureTextEntry
            placeholder="Ripeti la password"
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

          <View style={{ marginTop: 28 }}>
            <PrimaryButton
              label="Crea account"
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>

          {/* Benefits row — soft trust signals under the CTA */}
          <View style={{ marginTop: 22, gap: 10 }}>
            {[
              "Spaced repetition basato su SM-2",
              "Funziona offline, sincronizza quando vuoi",
              "I tuoi ricordi sono crittografati",
            ].map((b) => (
              <View
                key={b}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <CheckCircle2
                  size={16}
                  color={colors.active}
                  strokeWidth={2}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: FONT.medium,
                    fontSize: 13.5,
                    color: colors.navy,
                  }}
                >
                  {b}
                </Text>
              </View>
            ))}
          </View>

          {/* Footer prompt */}
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
              Hai già un account?{" "}
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

function FieldLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: { marginTop?: number };
}) {
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
