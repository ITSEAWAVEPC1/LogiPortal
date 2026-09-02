import { redirect } from "next/navigation";
import { Activity, Briefcase, ClipboardList, IndianRupee } from "lucide-react";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { dashboardScope } from "@/lib/permissions/scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueBarChart } from "@/components/dashboard/RevenueBarChart";
import { RecentJobsTable } from "@/components/dashboard/RecentJobsTable";
import { money } from "@/components/portal/portal-format";
import {
  getDashboardStats,
  getRecentJobs,
  getRevenueByMonth,
} from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  if (!canAccessScreen(role, "dashboard")) redirect("/");

  const scope = dashboardScope({
    role,
    id: session.user.id,
    branchId: session.user.branchId,
  });

  const [stats, revenueByMonth, recentJobs, branchName] = await Promise.all([
    getDashboardStats(scope),
    getRevenueByMonth(scope),
    getRecentJobs(scope, 8),
    scope.kind === "BRANCH" && scope.branchIds.length === 1
      ? prisma.branch
          .findUnique({ where: { id: scope.branchIds[0] }, select: { name: true } })
          .then((b) => b?.name ?? null)
      : Promise.resolve(null),
  ]);

  const scopeLabel =
    scope.kind === "ALL" ? "All branches" : branchName ? `${branchName} branch` : "Your branch";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary">{scopeLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total jobs"
          value={stats.totalJobs.toLocaleString("en-IN")}
          icon={Briefcase}
          accent="teal"
          hint={`${stats.completedJobs.toLocaleString("en-IN")} completed`}
        />
        <StatCard
          label="Ongoing"
          value={stats.ongoingJobs.toLocaleString("en-IN")}
          icon={Activity}
          accent="plum"
          hint="Workflow in progress"
        />
        <StatCard
          label="Pending review"
          value={stats.pendingReviewJobs.toLocaleString("en-IN")}
          icon={ClipboardList}
          accent="plum"
          hint="Awaiting Branch Manager"
        />
        <StatCard
          label="Revenue (quoted)"
          value={money(stats.revenueTotal, "INR")}
          icon={IndianRupee}
          accent="teal"
          hint="Sum of job values"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by month</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueBarChart
            data={revenueByMonth.map((p) => ({ month: p.month, revenue: p.revenue }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentJobsTable rows={recentJobs} />
        </CardContent>
      </Card>
    </div>
  );
}
