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
  const pendingOnboarding = useAuthStore((s) => s.pendingOnboarding);
  const pendingPasswordReset = useAuthStore((s) => s.pendingPasswordReset);
  // Admin "Apri l'app come utente": while set, an admin is treated like a
  // regular user by the (auth)/(app) surfaces. The admin surface itself
  // never bounces an admin, so "Torna al pannello admin" only needs to
  // clear the flag and navigate.
  const viewAsUser = useAuthStore((s) => s.viewAsUser);
  const adminViewingAsUser = user?.role === "admin" && viewAsUser;

  // The root layout already gates rendering on `hydrated`, but each group
  // re-checks defensively in case a future change to the root forgets to.
  if (!hydrated) return null;

  if (surface === "auth") {
    // Freshly signed-up user is walking through onboarding — let the (auth)
    // stack render instead of redirecting them to the app surface.
    if (user && pendingOnboarding) return null;
    // A recovery link just created a session: keep the user on
    // /(auth)/reset-password until they save a new password.
    if (user && pendingPasswordReset) return null;
    if (user?.role === "admin" && !adminViewingAsUser) return <Redirect href="/(admin)/home" />;
    if (user) return <Redirect href="/(app)/today" />;
    return null;
  }

  if (surface === "app") {
    if (!user) return <Redirect href="/(auth)/login" />;
    if (pendingPasswordReset) return <Redirect href={"/(auth)/reset-password" as never} />;
    if (user.role === "admin" && !adminViewingAsUser) return <Redirect href="/(admin)/home" />;
    return null;
  }

  // surface === "admin"
  if (!user) return <Redirect href="/(auth)/login" />;
  if (pendingPasswordReset) return <Redirect href={"/(auth)/reset-password" as never} />;
  if (user.role !== "admin") return <Redirect href="/(app)/today" />;
  return null;
}
