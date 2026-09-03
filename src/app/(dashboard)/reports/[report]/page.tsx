import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { reportScope } from "@/lib/permissions/scope";
import { canSeeReport, isReportKey, REPORT_META } from "@/lib/reports/access";
import { resolvePeriod } from "@/lib/reports/period";
import { runReport } from "@/lib/reports";
import { listReportBranches } from "@/lib/reports/common";
import { ReportView } from "@/components/reports/ReportView";

interface ReportPageProps {
  params: Promise<{ report: string }>;
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    branchId?: string;
    organizationId?: string;
    serviceType?: string;
  }>;
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  if (!canAccessScreen(role, "reports")) redirect("/");

  const { report } = await params;
  if (!isReportKey(report) || !canSeeReport(role, report)) redirect("/reports");

  const sp = await searchParams;
  const period = resolvePeriod(sp.period ?? "YTD", sp.from, sp.to);
  const scope = reportScope({ role, id: session.user.id, branchId: session.user.branchId });

  const result = await runReport(report, scope, {
    period,
    branchId: sp.branchId || undefined,
    organizationId: sp.organizationId || undefined,
    serviceType: sp.serviceType || undefined,
  });

  // ADMIN / ACCOUNTS get a branch filter; a BRANCH_MANAGER is pinned by scope.
  const branches = scope.kind === "ALL" ? await listReportBranches(null) : null;

  const csvParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) csvParams.set(k, v);
  const csvHref = `/api/reports/${report}/export${csvParams.toString() ? `?${csvParams}` : ""}`;

  return (
    <ReportView
      title={REPORT_META[report].title}
      description={REPORT_META[report].description}
      result={result}
      periodLabel={period.label}
      filters={{
        period: period.key,
        from: sp.from ?? "",
        to: sp.to ?? "",
        branchId: sp.branchId ?? "",
      }}
      branches={branches}
      csvHref={csvHref}
      liveSnapshot={report === "pending-ageing"}
    />
  );
}
