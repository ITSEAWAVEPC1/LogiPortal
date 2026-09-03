import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { NotificationList } from "./_components/NotificationList";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-text-primary">Notifications</h1>
      <NotificationList />
    </div>
  );
}
