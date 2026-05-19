import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenStub } from "@/components/ScreenStub";
import { useAuthStore } from "@/lib/auth-store";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const initials = (user?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <ScreenStub title="Settings">
      {/* Profile card */}
      <View
        className="mx-4 mt-2 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3.5"
        style={{ borderWidth: 1, borderColor: "rgba(26,44,79,0.08)" }}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-pill bg-navy"
        >
          <Text
            className="text-body-lg text-surface"
            style={{ fontFamily: "Inter_600SemiBold" }}
          >
            {initials || "M"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-body-lg text-navy" style={{ fontFamily: "Inter_600SemiBold" }}>
            {user?.name ?? ""}
          </Text>
          <Text className="text-caption text-mid-grey" style={{ fontFamily: "Inter_400Regular" }}>
            {user?.email ?? ""}
          </Text>
        </View>
      </View>

      {/* Danger zone */}
      <View className="mt-8 px-6 pb-2">
        <Text
          className="text-xs-tight text-fading"
          style={{ fontFamily: "Inter_700Bold", textTransform: "uppercase" }}
        >
          Danger zone
        </Text>
      </View>
      <Pressable
        onPress={handleSignOut}
        className="mx-4 rounded-card bg-surface px-4 py-3.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          borderWidth: 1,
          borderColor: "rgba(26,44,79,0.14)",
        })}
      >
        <Text className="text-body text-navy" style={{ fontFamily: "Inter_600SemiBold" }}>
          Sign out
        </Text>
        <Text
          className="mt-1 text-caption text-mid-grey"
          style={{ fontFamily: "Inter_400Regular", lineHeight: 18 }}
        >
          You'll need your email and password to sign back in.
        </Text>
      </Pressable>
    </ScreenStub>
  );
}
