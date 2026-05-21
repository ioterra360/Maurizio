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
import { Link } from "expo-router";

import { Mascot } from "@/components/Mascot";
import { PrimaryButton } from "@/components/PrimaryButton";
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
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

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
          {/* Hero — mascot floats above a soft warm wash */}
          <View className="items-center" style={{ paddingTop: 32, paddingBottom: 36 }}>
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 999,
                backgroundColor: colors.warmWhite,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.navy,
                shadowOpacity: 0.06,
                shadowOffset: { width: 0, height: 10 },
                shadowRadius: 22,
                elevation: 2,
              }}
            >
              <Mascot size={104} />
            </View>
            <Text
              style={{
                marginTop: 24,
                fontFamily: FONT.bold,
                fontSize: 32,
                lineHeight: 38,
                letterSpacing: -0.4,
                color: colors.navy,
              }}
            >
              Memora
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontFamily: FONT.regular,
                fontSize: 15,
                lineHeight: 22,
                color: colors.midGrey,
                textAlign: "center",
              }}
            >
              Your memory, well taken care of
            </Text>
          </View>

          {/* Email */}
          <FieldLabel>Email</FieldLabel>
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
            style={{
              height: 56,
              fontFamily: FONT.medium,
              borderWidth: 1.5,
              borderColor: focused === "email" ? colors.navy : colors.hairline,
            }}
          />

          {/* Password */}
          <View
            className="mt-5 flex-row items-end justify-between"
            style={{ marginBottom: 8 }}
          >
            <FieldLabel className="mb-0">Password</FieldLabel>
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
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            autoComplete="current-password"
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={{
              height: 56,
              fontFamily: FONT.medium,
              borderWidth: 1.5,
              borderColor: focused === "password" ? colors.navy : colors.hairline,
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

          {/* Submit */}
          <View style={{ marginTop: 28 }}>
            <PrimaryButton label="Accedi" onPress={handleSubmit} loading={loading} />
          </View>

          {/* Sign up prompt */}
          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 14,
                color: colors.midGrey,
              }}
            >
              Non hai un account?{" "}
            </Text>
            <Link href={"/(auth)/signup" as never} asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 14,
                    color: colors.navy,
                  }}
                >
                  Registrati
                </Text>
              </Pressable>
            </Link>
          </View>

          {/* Demo accounts — bracketed by hairlines */}
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

          {isDemoMode && (
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={className}
      style={{
        marginBottom: 8,
        fontFamily: FONT.semibold,
        fontSize: 11,
        letterSpacing: 1.3,
        textTransform: "uppercase",
        color: colors.midGrey,
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
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isAdmin ? colors.navy : colors.tagUserBg,
        }}
      >
        <Text
          style={{
            color: isAdmin ? "#fff" : colors.navy,
            fontFamily: FONT.semibold,
            fontSize: 14,
            letterSpacing: 0.4,
          }}
        >
          {account.initials}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy }}>
          {account.name}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: FONT.regular,
            fontSize: 12.5,
            color: colors.midGrey,
          }}
        >
          {account.email}
        </Text>
      </View>

      <View
        className="rounded-tag"
        style={{
          paddingHorizontal: 8,
          paddingVertical: 3,
          backgroundColor: isAdmin ? colors.navy : colors.tagUserBg,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.bold,
            fontSize: 9.5,
            letterSpacing: 0.6,
            color: isAdmin ? "#fff" : colors.navy,
          }}
        >
          {isAdmin ? "ADMIN" : "USER"}
        </Text>
      </View>
    </Pressable>
  );
}
