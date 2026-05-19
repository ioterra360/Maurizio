import { Stack } from "expo-router";
import { useAuthGate } from "@/lib/auth-gate";

export default function AuthLayout() {
  const gate = useAuthGate("auth");
  if (gate) return gate;
  return <Stack screenOptions={{ headerShown: false }} />;
}
