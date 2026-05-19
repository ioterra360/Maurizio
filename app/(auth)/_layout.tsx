import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../lib/auth-store";

export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  if (user) {
    return user.role === "admin"
      ? <Redirect href="/(admin)/home" />
      : <Redirect href="/(app)/today" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
