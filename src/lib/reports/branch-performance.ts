import { prisma } from "@/lib/db/prisma";
import { jobScopeWhere, type Scope } from "@/lib/permissions/scope";
import { branchWhere, listReportBranches, onTimeRate, pct, resolveReportBranchIds } from "./common";
import type { ReportFilters, ReportResult } from "./types";

// Per branch, for the period: jobs created, jobs delivered (actualDeliveryDate
// in period), on-time % (over jobs with both delivery dates), and revenue
// (sum of quotedTotal for jobs created in the period, not currency-converted).
export async function branchPerformanceReport(
  scope: Scope,
  filters: ReportFilters,
): Promise<ReportResult> {
  const { period } = filters;
  const branchIds = resolveReportBranchIds(scope, filters.branchId);
  const scopeWhere = jobScopeWhere(scope);
  const bWhere = branchWhere(branchIds);

  const [branches, created, delivered] = await Promise.all([
    listReportBranches(branchIds),
    prisma.job.groupBy({
      by: ["branchId"],
      where: { ...scopeWhere, ...bWhere, createdAt: { gte: period.gte, lt: period.lt } },
      _count: { _all: true },
      _sum: { quotedTotal: true },
    }),
    prisma.job.findMany({
      where: { ...scopeWhere, ...bWhere, actualDeliveryDate: { gte: period.gte, lt: period.lt } },
      select: { branchId: true, expectedDeliveryDate: true, actualDeliveryDate: true },
    }),
  ]);

  const createdByBranch = new Map(created.map((r) => [r.branchId, r]));
  const deliveredByBranch = new Map<string, typeof delivered>();
  for (const j of delivered) {
    const list = deliveredByBranch.get(j.branchId) ?? [];
    list.push(j);
    deliveredByBranch.set(j.branchId, list);
  }

  const rows = branches.map((b) => {
    const c = createdByBranch.get(b.id);
    const del = deliveredByBranch.get(b.id) ?? [];
    return {
      branch: b.name,
      jobsCreated: c?._count._all ?? 0,
      jobsDelivered: del.length,
      onTime: pct(onTimeRate(del)),
      revenue: c?._sum.quotedTotal ?? 0,
    };
  });

  const sum = (k: "jobsCreated" | "jobsDelivered" | "revenue") =>
    rows.reduce((s, r) => s + (r[k] as number), 0);

  return {
    table: {
      columns: [
        { key: "branch", header: "Branch" },
        { key: "jobsCreated", header: "Jobs created", numeric: true },
        { key: "jobsDelivered", header: "Delivered", numeric: true },
        { key: "onTime", header: "On-time", numeric: true },
        { key: "revenue", header: "Revenue", numeric: true, money: true },
      ],
      rows,
      total: {
        branch: "All branches",
        jobsCreated: sum("jobsCreated"),
        jobsDelivered: sum("jobsDelivered"),
        onTime: pct(onTimeRate(delivered)),
        revenue: sum("revenue"),
      },
    },
    chart: {
      kind: "bar",
      xKey: "branch",
      data: rows.map((r) => ({ branch: r.branch as string, revenue: r.revenue as number })),
      series: [{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }],
    },
    note: "Revenue = sum of quoted total for jobs created in the period. Amounts are not currency-converted.",
  };
}
