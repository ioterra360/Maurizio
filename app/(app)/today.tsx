import { useAuthStore } from "../../lib/auth-store";
import { ScreenStub } from "../../components/ScreenStub";

export default function TodayScreen() {
  const name = useAuthStore((s) => s.user?.name ?? "");
  const greeting = greetingForNow();
  const firstName = name.split(" ")[0] || "";

  return (
    <ScreenStub
      greeting={`${greeting}${firstName ? `, ${firstName}` : ""}`}
      title="Today"
      note="Phase 2 will land here: time-budget chips (5 / 15 / 30 / 1 hr), the Scan → Reinforcement → Focus recommended flow, and the primary CTA. The recommended order is locked: Scan first."
    />
  );
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
