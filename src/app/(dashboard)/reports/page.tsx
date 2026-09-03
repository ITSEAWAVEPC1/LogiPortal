import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { REPORT_META, visibleReports } from "@/lib/reports/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  if (!canAccessScreen(role, "reports")) redirect("/");

  const reports = visibleReports(role);
  if (reports.length === 0) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Reports</h1>
        <p className="text-sm text-text-secondary">
          Scoped to your branch where applicable; Accounts and Admin see all branches.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((k) => (
          <Link key={k} href={`/reports/${k}`}>
            <Card className="h-full transition-colors hover:border-brand-teal">
              <CardHeader>
                <CardTitle>{REPORT_META[k].title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-text-secondary">{REPORT_META[k].description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
