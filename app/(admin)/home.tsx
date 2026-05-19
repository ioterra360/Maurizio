import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuthStore } from "../../lib/auth-store";

export default function AdminHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
          <View className="flex-1">
            <Text className="text-body text-mid-grey" style={{ fontFamily: "Inter_500Medium" }}>
              Welcome back
            </Text>
            <Text
              className="text-h1 text-navy"
              style={{ fontFamily: "Inter_700Bold", lineHeight: 33 }}
            >
              {user?.name ?? "Admin"}
            </Text>
          </View>
          <View className="rounded-chip px-2.5 py-1" style={{ backgroundColor: "#1A2C4F" }}>
            <Text
              style={{
                color: "#fff",
                fontFamily: "Inter_700Bold",
                fontSize: 10,
                letterSpacing: 1.2,
              }}
            >
              ADMIN
            </Text>
          </View>
        </View>

        <View
          className="mx-4 rounded-card bg-surface p-5"
          style={{ borderWidth: 1, borderColor: "rgba(26,44,79,0.08)" }}
        >
          <Text className="text-h2 text-navy" style={{ fontFamily: "Inter_700Bold" }}>
            Admin panel — coming in Phase 4
          </Text>
          <Text
            className="mt-2 text-body text-mid-grey"
            style={{ fontFamily: "Inter_400Regular", lineHeight: 20 }}
          >
            The mobile admin shell (Home / Users / Moderation / Insights / More) is
            scheduled after the user-facing app is feature-complete. For now this is just
            the auth gate confirming admin role detection works.
          </Text>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="mx-4 mt-4 rounded-card bg-surface p-4"
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
            borderWidth: 1,
            borderColor: "rgba(26,44,79,0.16)",
          })}
        >
          <Text className="text-body text-navy" style={{ fontFamily: "Inter_600SemiBold" }}>
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
