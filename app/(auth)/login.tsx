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

import { Mascot } from "../../components/Mascot";
import { useAuthStore, DEMO_ACCOUNTS } from "../../lib/auth-store";
import { isSupabaseConfigured } from "../../lib/supabase";

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
      await signIn(email.trim(), password);
      const next = useAuthStore.getState().user;
      if (next?.role === "admin") router.replace("/(admin)/home");
      else router.replace("/(app)/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    }
  };

  const fillDemo = (key: keyof typeof DEMO_ACCOUNTS) => {
    setEmail(DEMO_ACCOUNTS[key].email);
    setPassword("demo");
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
              style={{ fontFamily: "Inter_700Bold" }}
            >
              Memora
            </Text>
            <Text
              className="mt-2 text-body text-mid-grey"
              style={{ fontFamily: "Inter_400Regular" }}
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
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#B5B3AE"
            className="rounded-card bg-surface px-4 py-4 text-body-lg text-navy"
            style={[
              {
                fontFamily: "Inter_500Medium",
                borderWidth: 1,
                borderColor: focused === "email" ? "#1A2C4F" : "rgba(26,44,79,0.08)",
              },
            ]}
          />

          {/* Password */}
          <FieldLabel className="mt-4">Password</FieldLabel>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#B5B3AE"
            className="rounded-card bg-surface px-4 py-4 text-body-lg text-navy"
            style={{
              fontFamily: "Inter_500Medium",
              borderWidth: 1,
              borderColor: focused === "password" ? "#1A2C4F" : "rgba(26,44,79,0.08)",
            }}
          />

          {error ? (
            <Text
              className="mt-3 text-caption text-danger"
              style={{ fontFamily: "Inter_500Medium" }}
            >
              {error}
            </Text>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="mt-6 h-14 items-center justify-center rounded-card bg-navy"
            style={({ pressed }) => ({
              opacity: pressed || loading ? 0.85 : 1,
              shadowColor: "#1A2C4F",
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 18,
              elevation: 4,
            })}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-cta text-surface" style={{ fontFamily: "Inter_600SemiBold" }}>
                Sign in
              </Text>
            )}
          </Pressable>

          <Pressable className="mt-4 items-center" onPress={() => {}}>
            <Text className="text-body text-mid-grey" style={{ fontFamily: "Inter_500Medium" }}>
              Forgot password?
            </Text>
          </Pressable>

          {/* Demo accounts */}
          <View className="mt-10">
            <Text
              className="text-xs-tight text-mid-grey"
              style={{ fontFamily: "Inter_700Bold", textTransform: "uppercase" }}
            >
              Demo accounts
            </Text>
            <View className="mt-3 gap-2">
              <DemoCard
                name="Angelo Casula"
                email="angelo.casula@gmail.com"
                tag="USER"
                onPress={() => fillDemo("angelo.casula@gmail.com")}
              />
              <DemoCard
                name="Maurizio Cocco"
                email="maurizio.cocco@memora.app"
                tag="ADMIN"
                onPress={() => fillDemo("maurizio.cocco@memora.app")}
              />
            </View>
            {!isSupabaseConfigured && (
              <Text
                className="mt-3 text-micro text-mid-grey"
                style={{ fontFamily: "Inter_400Regular", lineHeight: 16 }}
              >
                Supabase not configured yet. Demo accounts work offline — any password is
                accepted. Add credentials in <Text style={{ fontFamily: "Inter_600SemiBold" }}>.env</Text> to switch to real auth.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Text
      className={`mb-2 text-micro text-mid-grey ${className}`}
      style={{ fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase" }}
    >
      {children}
    </Text>
  );
}

function DemoCard({
  name,
  email,
  tag,
  onPress,
}: {
  name: string;
  email: string;
  tag: "USER" | "ADMIN";
  onPress: () => void;
}) {
  const isAdmin = tag === "ADMIN";
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-card bg-surface px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        borderWidth: 1,
        borderColor: "rgba(26,44,79,0.08)",
      })}
    >
      <View className="flex-1">
        <Text className="text-body text-navy" style={{ fontFamily: "Inter_600SemiBold" }}>
          {name}
        </Text>
        <Text className="mt-0.5 text-caption text-mid-grey" style={{ fontFamily: "Inter_400Regular" }}>
          {email}
        </Text>
      </View>
      <View
        className="rounded-chip px-2.5 py-1"
        style={{ backgroundColor: isAdmin ? "#1A2C4F" : "rgba(26,44,79,0.08)" }}
      >
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 10,
            letterSpacing: 1.2,
            color: isAdmin ? "#fff" : "#1A2C4F",
          }}
        >
          {tag}
        </Text>
      </View>
    </Pressable>
  );
}
