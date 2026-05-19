import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "admin") return <Redirect href="/(app)/today" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
