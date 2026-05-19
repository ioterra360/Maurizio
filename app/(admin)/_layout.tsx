import { Stack } from "expo-router";
import { useAuthGate } from "@/lib/auth-gate";

export default function AdminLayout() {
  const gate = useAuthGate("admin");
  if (gate) return gate;
  return <Stack screenOptions={{ headerShown: false }} />;
}
