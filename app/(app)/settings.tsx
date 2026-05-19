import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenStub } from "../../components/ScreenStub";
import { useAuthStore } from "../../lib/auth-store";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <ScreenStub
      title="Settings"
      note="Phase 2 will land here: profile (name + avatar), schedule rows, daily input cap, calm mode + weekly digest toggles, and the danger zone (sign out + delete account)."
    >
      <View className="mx-4 mt-3 rounded-card bg-surface p-4" style={{ borderWidth: 1, borderColor: "rgba(26,44,79,0.08)" }}>
        <Text
          className="text-micro text-mid-grey"
          style={{ fontFamily: "Inter_700Bold", letterSpacing: 1.5, textTransform: "uppercase" }}
        >
          Signed in as
        </Text>
        <Text className="mt-2 text-body-lg text-navy" style={{ fontFamily: "Inter_600SemiBold" }}>
          {user?.name ?? ""}
        </Text>
        <Text className="text-caption text-mid-grey" style={{ fontFamily: "Inter_400Regular" }}>
          {user?.email ?? ""}
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
        <Text className="mt-1 text-caption text-mid-grey" style={{ fontFamily: "Inter_400Regular", lineHeight: 18 }}>
          You'll need your email and password to sign back in.
        </Text>
      </Pressable>
    </ScreenStub>
  );
}
