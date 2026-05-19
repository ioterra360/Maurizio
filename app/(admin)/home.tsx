import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { useAuthStore } from "@/lib/auth-store";

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
        <View className="px-6 pt-5 pb-6">
          <Text className="text-body text-mid-grey" style={{ fontFamily: "Inter_500Medium" }}>
            Welcome back
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text
              className="text-h1 text-navy"
              style={{ fontFamily: "Inter_700Bold" }}
              accessibilityRole="header"
            >
              {user?.name ?? "Admin"}
            </Text>
            <View
              className="rounded-tag px-1.5 py-0.5"
              style={{ backgroundColor: "#1A2C4F" }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Inter_700Bold",
                  fontSize: 9.5,
                  letterSpacing: 0.8,
                }}
              >
                ADMIN
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="mx-4 mt-4 rounded-card bg-surface px-4 py-3.5"
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
            borderWidth: 1,
            borderColor: "rgba(26,44,79,0.14)",
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
