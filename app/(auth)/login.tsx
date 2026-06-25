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
import { Link } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { AuthTextInput } from "@/components/AuthTextInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore, DEMO_ACCOUNTS, type DemoAccount } from "@/lib/auth-store";
import { isDemoMode } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { colors, FONT } from "@/theme/tokens";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Routing happens via (auth)/_layout.tsx redirect on next render —
      // no imperative router.replace needed.
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  const fillDemo = (acct: DemoAccount) => {
    setEmail(acct.email);
    setPassword("demo");
    setError(null);
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
          {/* Hero — mascot displayed at editorial scale per design contract */}
          <View className="items-center" style={{ paddingTop: 20, paddingBottom: 24 }}>
            <Mascot variant="idea" size={92} withShadow={false} />
            <Text
              style={{
                marginTop: 12,
                fontFamily: FONT.bold,
                fontSize: 28,
                lineHeight: 34,
                letterSpacing: -0.5,
                color: colors.navy,
              }}
            >
              Memika
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: FONT.regular,
                fontSize: 14.5,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
              }}
            >
              La tua memoria, ben curata
            </Text>
          </View>

          {/* Email */}
          <FieldLabel>Email</FieldLabel>
          <AuthTextInput
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

          {/* Password */}
          <View
            className="mt-5 flex-row items-end justify-between"
            style={{ marginBottom: 8 }}
          >
            <FieldLabel style={{ marginBottom: 0 }}>Password</FieldLabel>
            <Link href={"/(auth)/forgot-password" as never} asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 12,
                    color: colors.navy,
                    letterSpacing: -0.06,
                  }}
                >
                  Password dimenticata?
                </Text>
              </Pressable>
            </Link>
          </View>
          <AuthTextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            secureTextEntry
            placeholder="••••••••"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!loading) void handleSubmit();
            }}
          />

          {/* Error pill */}
          {error ? (
            <View
              className="mt-4 self-start rounded-chip px-3 py-2"
              style={{ backgroundColor: colors.dangerSoft }}
            >
              <Text
                className="text-caption"
                style={{
                  fontFamily: FONT.medium,
                  color: colors.danger,
                  letterSpacing: -0.06,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* CTAs — Accedi (primary outlined) + Registrati (outline secondary) */}
          <View style={{ marginTop: 26, gap: 12 }}>
            <PrimaryButton label="Accedi" onPress={handleSubmit} loading={loading} />
            <Link href={"/(auth)/signup" as never} asChild>
              <Pressable accessibilityRole="link">
                <View pointerEvents="none">
                  <GhostButton label="Crea un nuovo account" variant="outline" />
                </View>
              </Pressable>
            </Link>
          </View>

          {/* Demo accounts — dev-only (isDemoMode is false in any production
              build), bracketed by hairlines */}
          {isDemoMode && (
            <>
              <View
                style={{
                  marginTop: 36,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
                <Text
                  style={{
                    fontFamily: FONT.bold,
                    fontSize: 10.5,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: colors.midGrey,
                  }}
                >
                  Demo accounts
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
              </View>

              <View style={{ marginTop: 18, gap: 12 }}>
                {DEMO_ACCOUNTS.map((acct) => (
                  <DemoCard key={acct.email} account={acct} onPress={() => fillDemo(acct)} />
                ))}
              </View>

              <Text
                style={{
                  marginTop: 16,
                  fontFamily: FONT.regular,
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.midGrey,
                }}
              >
                Demo mode attivo. Accedi con uno dei due account sopra — le password
                vengono accettate senza verifica. Disattiva{" "}
                <Text style={{ fontFamily: FONT.semibold }}>EXPO_PUBLIC_DEMO_MODE</Text>{" "}
                in <Text style={{ fontFamily: FONT.semibold }}>.env</Text> per attivare
                l'auth reale.
              </Text>
            </>
          )}
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
  style?: { marginBottom?: number; marginTop?: number };
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

function DemoCard({
  account,
  onPress,
}: {
  account: DemoAccount;
  onPress: () => void;
}) {
  const isAdmin = account.role === "admin";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Usa account demo ${account.name}, ${isAdmin ? "admin" : "utente"}`}
      className="flex-row items-center rounded-card bg-surface"
      style={({ pressed }) => ({
        paddingVertical: 16,
        paddingHorizontal: 16,
        opacity: pressed ? 0.85 : 1,
        borderWidth: 1,
        borderColor: colors.hairline,
        gap: 14,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.tagUserBg,
          borderWidth: isAdmin ? 2 : 0,
          borderColor: colors.navy,
        }}
      >
        <Text
          style={{
            color: colors.navy,
            fontFamily: FONT.bold,
            fontSize: 16,
            letterSpacing: 0.3,
          }}
        >
          {account.initials}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.semibold, fontSize: 16, color: colors.navy }}>
          {account.name}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontFamily: FONT.regular,
            fontSize: 13.5,
            color: colors.midGrey,
          }}
        >
          {account.email}
        </Text>
      </View>

      <View
        className="rounded-tag"
        style={{
          paddingHorizontal: 9,
          paddingVertical: 4,
          backgroundColor: colors.tagUserBg,
          borderWidth: isAdmin ? 1 : 0,
          borderColor: colors.navy,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 10.5,
            letterSpacing: 0.6,
            color: colors.navy,
          }}
        >
          {isAdmin ? "ADMIN" : "USER"}
        </Text>
      </View>
    </Pressable>
  );
}
