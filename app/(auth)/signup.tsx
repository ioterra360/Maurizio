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
import { ChevronLeft, CheckCircle2 } from "lucide-react-native";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
import { isDemoMode, supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { colors, FONT } from "@/theme/tokens";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [focused, setFocused] = useState<
    "name" | "email" | "password" | "confirm" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });
      if (signUpError) {
        setError(authErrorMessage(signUpError));
        return;
      }
      router.replace("/(auth)/onboarding" as never);
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
          <View className="items-center" style={{ paddingTop: 12, paddingBottom: 28 }}>
            <Mascot size={72} />
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
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused("name")}
            onBlur={() => setFocused(null)}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Il tuo nome"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={inputStyle(focused === "name")}
          />

          <FieldLabel style={{ marginTop: 18 }}>Email</FieldLabel>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="tu@esempio.com"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={inputStyle(focused === "email")}
          />

          <FieldLabel style={{ marginTop: 18 }}>Password</FieldLabel>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            autoComplete="new-password"
            secureTextEntry
            placeholder="Almeno 8 caratteri"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={inputStyle(focused === "password")}
          />

          <FieldLabel style={{ marginTop: 18 }}>Conferma password</FieldLabel>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            onFocus={() => setFocused("confirm")}
            onBlur={() => setFocused(null)}
            autoComplete="new-password"
            secureTextEntry
            placeholder="Ripeti la password"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={inputStyle(focused === "confirm")}
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

function inputStyle(focusedNow: boolean) {
  return {
    height: 54,
    fontFamily: FONT.medium,
    borderWidth: 1.5,
    borderColor: focusedNow ? colors.navy : colors.hairline,
  } as const;
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
