import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function ReviewLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF8F4" },
        animation: "fade",
      }}
    />
  );
}
