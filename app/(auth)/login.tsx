import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Mascot } from "@/components/Mascot";
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
      setError("Enter your email and password.");
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
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View className="items-center pt-12 pb-8">
            <Mascot size={96} />
            <Text
              className="mt-4 text-h1 text-navy"
              style={{ fontFamily: FONT.bold }}
            >
              Memora
            </Text>
            <Text
              className="mt-2 text-body text-mid-grey"
              style={{ fontFamily: FONT.regular }}
            >
              Sign in to your account
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
            placeholder="you@example.com"
            placeholderTextColor={colors.placeholder}
            className="rounded-input bg-surface px-4 text-body-lg text-navy"
            style={{
              height: 50,
              fontFamily: FONT.medium,
              borderWidth: 1.5,
              borderColor: focused === "email" ? colors.navy : colors.hairline,
            }}
          />

          {/* Password */}
          <FieldLabel className="mt-4">Password</FieldLabel>
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
              height: 50,
              fontFamily: FONT.medium,
              borderWidth: 1.5,
              borderColor: focused === "password" ? colors.navy : colors.hairline,
            }}
          />

          {/* Error pill — matches mockup style (soft red bg, danger text) */}
          {error ? (
            <View
              className="mt-3 self-start rounded-chip px-3 py-2"
              style={{ backgroundColor: colors.dangerSoft }}
            >
              <Text
                className="text-caption"
                style={{ fontFamily: FONT.medium, color: colors.danger, letterSpacing: -0.06 }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            className="mt-6 items-center justify-center rounded-cta bg-navy"
            style={({ pressed }) => ({
              height: 50,
              opacity: pressed || loading ? 0.85 : 1,
              shadowColor: colors.navy,
              shadowOpacity: 0.4,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 18,
              elevation: 4,
            })}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-cta text-surface" style={{ fontFamily: FONT.semibold }}>
                Sign in
              </Text>
            )}
          </Pressable>

          {/* Demo accounts section — bracketed by hairlines (editorial pattern) */}
          <View className="mt-10 flex-row items-center" style={{ gap: 10 }}>
            <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
            <Text
              className="text-xs-tight text-mid-grey"
              style={{ fontFamily: FONT.bold, textTransform: "uppercase" }}
            >
              Demo accounts
            </Text>
            <View className="h-px flex-1" style={{ backgroundColor: colors.divider }} />
          </View>

          <View className="mt-4" style={{ gap: 8 }}>
            {DEMO_ACCOUNTS.map((acct) => (
              <DemoCard key={acct.email} account={acct} onPress={() => fillDemo(acct)} />
            ))}
          </View>

          {isDemoMode && (
            <Text
              className="mt-3 text-micro text-mid-grey"
              style={{ fontFamily: FONT.regular, lineHeight: 16 }}
            >
              Demo mode is active. Sign in with any of the two seed accounts above —
              passwords are accepted as-is. Disable{" "}
              <Text style={{ fontFamily: FONT.semibold }}>EXPO_PUBLIC_DEMO_MODE</Text> in{" "}
              <Text style={{ fontFamily: FONT.semibold }}>.env</Text> to switch to real auth.
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
      className={`mb-2 text-micro text-mid-grey ${className}`}
      style={{
        fontFamily: FONT.semibold,
        letterSpacing: 1.3,
        textTransform: "uppercase",
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
      accessibilityLabel={`Use demo account ${account.name}, ${isAdmin ? "admin" : "user"}`}
      className="flex-row items-center rounded-card bg-surface px-3 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        borderWidth: 1,
        borderColor: colors.hairline,
        gap: 12,
      })}
    >
      {/* Initials avatar — navy bg for admin, soft-blue bg for user */}
      <View
        className="h-9 w-9 items-center justify-center rounded-pill"
        style={{ backgroundColor: isAdmin ? colors.navy : colors.tagUserBg }}
      >
        <Text
          style={{
            color: isAdmin ? "#fff" : colors.navy,
            fontFamily: FONT.semibold,
            fontSize: 12.5,
            letterSpacing: 0.4,
          }}
        >
          {account.initials}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-body text-navy" style={{ fontFamily: FONT.semibold }}>
          {account.name}
        </Text>
        <Text
          className="mt-0.5 text-caption text-mid-grey"
          style={{ fontFamily: FONT.regular }}
        >
          {account.email}
        </Text>
      </View>

      <View
        className="rounded-tag px-2 py-0.5"
        style={{ backgroundColor: isAdmin ? colors.navy : colors.tagUserBg }}
      >
        <Text
          className="text-xs-tag"
          style={{
            fontFamily: FONT.bold,
            color: isAdmin ? "#fff" : colors.navy,
          }}
        >
          {isAdmin ? "ADMIN" : "USER"}
        </Text>
      </View>
    </Pressable>
  );
}
