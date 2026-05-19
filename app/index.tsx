import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function Index() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "admin") return <Redirect href="/(admin)/home" />;
  return <Redirect href="/(app)/today" />;
}
