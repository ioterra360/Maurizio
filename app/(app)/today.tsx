import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/lib/auth-store";

export default function TodayScreen() {
  const name = useAuthStore((s) => s.user?.name ?? "");
  const firstName = name.split(" ")[0] ?? "";

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <View className="px-6 pt-5 pb-6">
        <Text
          className="text-body text-mid-grey"
          style={{ fontFamily: "Inter_500Medium" }}
        >
          {greetingForNow()}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <Text
          className="mt-1 text-h1 text-navy"
          style={{ fontFamily: "Inter_700Bold" }}
          accessibilityRole="header"
        >
          Today
        </Text>
      </View>
    </SafeAreaView>
  );
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
