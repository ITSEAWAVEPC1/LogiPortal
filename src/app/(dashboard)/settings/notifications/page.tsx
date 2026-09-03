import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { NotificationPreferenceForm } from "./_components/NotificationPreferenceForm";

// Self-service — reachable by every authenticated internal role (no capability
// gate, unlike the Admin-only /settings/* tiles).
export default async function NotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Notification preferences</h1>
        <p className="text-sm text-text-secondary">Choose which updates you receive and how.</p>
      </div>
      <NotificationPreferenceForm />
    </div>
  );
}
