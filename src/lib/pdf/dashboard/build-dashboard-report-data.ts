// Stage 10b — assembles the CXO "Download report" PDF payload. Pure data
// (no react-pdf, no IO beyond the report queries it composes), so the route
// handler stays plain .ts. Reuses the same scoped queries the on-screen
// dashboard / reports use.

import { prisma } from "@/lib/db/prisma";
import type { Scope } from "@/lib/permissions/scope";
import type { Period } from "@/lib/reports/period";
import { getCxoKpis } from "@/lib/dashboard/kpis";
import { branchPerformanceReport } from "@/lib/reports/branch-performance";
import { revenueReport } from "@/lib/reports/revenue";

export interface DashboardReportData {
  generatedAt: string;
  scopeLabel: string;
  periodLabel: string;
  kpis: { jobsCreated: number; jobsDelivered: number; onTimeRate: number | null; revenue: number };
  branchRows: Array<{
    branch: string;
    jobsCreated: number;
    jobsDelivered: number;
    onTime: string;
    revenue: number;
  }>;
  revenueByMonth: Array<{ month: string; quoted: number; converted: number }>;
}

export async function buildDashboardReportData(
  scope: Scope,
  period: Period,
): Promise<DashboardReportData> {
  const [kpis, branchPerf, revenue, scopeLabel] = await Promise.all([
    getCxoKpis(scope, period),
    branchPerformanceReport(scope, { period }),
    revenueReport(scope, { period }),
    scope.kind === "BRANCH" && scope.branchIds.length === 1
      ? prisma.branch
          .findUnique({ where: { id: scope.branchIds[0] }, select: { name: true } })
          .then((b) => (b?.name ? `${b.name} branch` : "Your branch"))
      : Promise.resolve("All branches"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    scopeLabel,
    periodLabel: period.label,
    kpis: {
      jobsCreated: kpis.jobsCreated,
      jobsDelivered: kpis.jobsDelivered,
      onTimeRate: kpis.onTimeRate,
      revenue: kpis.revenue,
    },
    branchRows: branchPerf.table.rows.map((r) => ({
      branch: String(r.branch ?? ""),
      jobsCreated: Number(r.jobsCreated ?? 0),
      jobsDelivered: Number(r.jobsDelivered ?? 0),
      onTime: String(r.onTime ?? "—"),
      revenue: Number(r.revenue ?? 0),
    })),
    revenueByMonth: revenue.table.rows.map((r) => ({
      month: String(r.month ?? ""),
      quoted: Number(r.quoted ?? 0),
      converted: Number(r.converted ?? 0),
    })),
  };
}
