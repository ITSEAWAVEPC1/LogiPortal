import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";

// Stage 10a — placeholder. Reachable by every authenticated internal role
// (no capability gate, unlike the Admin-only /settings/* tiles). Stage 10c
// replaces the body with the real NotificationPreference form.
export default async function NotificationPreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Notification preferences</h1>
        <p className="text-sm text-text-secondary">Choose which updates you receive and how.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            In-app and email notification controls arrive with the notifications update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
