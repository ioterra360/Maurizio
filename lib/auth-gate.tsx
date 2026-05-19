import { Redirect } from "expo-router";
import { useAuthStore } from "./auth-store";

type Surface = "auth" | "app" | "admin";

/**
 * Single source of truth for "given the current user, where should they be?".
 * Each route group's `_layout.tsx` calls this with its own `surface`.
 *
 * Returns:
 *   - null  → render the children (the user is where they should be)
 *   - a Redirect element → render this instead of the children
 *
 * Centralizing the decision means a future flow change (paywall, email
 * verification, onboarding flag) lives in ONE place instead of four.
 */
export function useAuthGate(surface: Surface) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  // The root layout already gates rendering on `hydrated`, but each group
  // re-checks defensively in case a future change to the root forgets to.
  if (!hydrated) return null;

  if (surface === "auth") {
    if (user?.role === "admin") return <Redirect href="/(admin)/home" />;
    if (user?.role === "user") return <Redirect href="/(app)/today" />;
    return null;
  }

  if (surface === "app") {
    if (!user) return <Redirect href="/(auth)/login" />;
    if (user.role === "admin") return <Redirect href="/(admin)/home" />;
    return null;
  }

  // surface === "admin"
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "admin") return <Redirect href="/(app)/today" />;
  return null;
}
