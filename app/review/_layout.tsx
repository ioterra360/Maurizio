import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";
import { useColors } from "@/theme/tokens";

export default function ReviewLayout() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.warmWhite },
        animation: "fade",
      }}
    />
  );
}
