import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function Index() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);

  // Wait for the auth-store to finish hydrating from SecureStore. Without
  // this gate, a cold-start with a valid session briefly flashes the login
  // redirect before onAuthStateChange repopulates `user`.
  if (!hydrated) return null;

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "admin") return <Redirect href="/(admin)/home" />;
  return <Redirect href="/(app)/today" />;
}
