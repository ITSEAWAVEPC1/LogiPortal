// Stage 10a — scoped read helpers for the internal /dashboard. Mirrors the
// shape of src/lib/portal/queries.ts (server-only, called straight from the
// page's server component). Every query is filtered through a Scope from
// src/lib/permissions/scope.ts. Stage 10b layers the CXO KPI queries on top.

import { prisma } from "@/lib/db/prisma";
import { jobScopeWhere, type Scope } from "@/lib/permissions/scope";

export interface DashboardStats {
  totalJobs: number;
  ongoingJobs: number;
  pendingReviewJobs: number;
  completedJobs: number;
  /** Sum of Job.quotedTotal across the scope, currency-agnostic (see note in the page). */
  revenueTotal: number;
}

export interface RevenueMonthPoint {
  /** "Apr 2026" */
  month: string;
  /** "2026-04" — stable sort/id key */
  monthKey: string;
  revenue: number;
}

export interface RecentJobRow {
  id: string;
  reference: string;
  organizationName: string;
  branchName: string;
  shipmentType: "IMPORT" | "EXPORT";
  status: string;
  quotedTotal: number | null;
  chargesCurrency: string | null;
  updatedAt: Date;
}

const MONTHS_BACK = 6;

export async function getDashboardStats(scope: Scope): Promise<DashboardStats> {
  const base = jobScopeWhere(scope);
  const [totalJobs, ongoingJobs, pendingReviewJobs, completedJobs, revenue] = await Promise.all([
    prisma.job.count({ where: base }),
    prisma.job.count({ where: { ...base, status: "WORKFLOW_IN_PROGRESS" } }),
    prisma.job.count({ where: { ...base, status: "PENDING_REVIEW" } }),
    prisma.job.count({ where: { ...base, status: "COMPLETED" } }),
    prisma.job.aggregate({ _sum: { quotedTotal: true }, where: base }),
  ]);

  return {
    totalJobs,
    ongoingJobs,
    pendingReviewJobs,
    completedJobs,
    revenueTotal: revenue._sum.quotedTotal ?? 0,
  };
}

/** Last 6 calendar months of Job.quotedTotal, bucketed by createdAt. Empty
 *  months are pre-seeded to 0 so the chart always has a full axis. */
export async function getRevenueByMonth(scope: Scope): Promise<RevenueMonthPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1);

  const jobs = await prisma.job.findMany({
    where: { ...jobScopeWhere(scope), createdAt: { gte: start } },
    select: { createdAt: true, quotedTotal: true },
  });

  const buckets = new Map<string, RevenueMonthPoint>();
  for (let i = 0; i < MONTHS_BACK; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      monthKey: key,
      revenue: 0,
    });
  }
  for (const j of jobs) {
    const d = j.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.revenue += j.quotedTotal ?? 0;
  }
  return [...buckets.values()];
}

export interface OnTimeStats {
  onTime: number;
  delayed: number;
  /** delivered without an expected date to compare against */
  noTarget: number;
}

/** On-time split over every delivered job in scope (actualDeliveryDate set). */
export async function getOnTimeStats(scope: Scope): Promise<OnTimeStats> {
  const rows = await prisma.job.findMany({
    where: { ...jobScopeWhere(scope), actualDeliveryDate: { not: null } },
    select: { expectedDeliveryDate: true, actualDeliveryDate: true },
  });
  let onTime = 0;
  let delayed = 0;
  let noTarget = 0;
  for (const r of rows) {
    if (!r.expectedDeliveryDate || !r.actualDeliveryDate) {
      noTarget++;
    } else if (r.actualDeliveryDate.getTime() <= r.expectedDeliveryDate.getTime()) {
      onTime++;
    } else {
      delayed++;
    }
  }
  return { onTime, delayed, noTarget };
}

export async function getRecentJobs(scope: Scope, take = 8): Promise<RecentJobRow[]> {
  const rows = await prisma.job.findMany({
    where: jobScopeWhere(scope),
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      referenceNo: true,
      sequenceNumber: true,
      shipmentType: true,
      status: true,
      quotedTotal: true,
      chargesCurrency: true,
      updatedAt: true,
      organization: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    reference: r.referenceNo ?? `JOB-${r.sequenceNumber}`,
    organizationName: r.organization.name,
    branchName: r.branch.name,
    shipmentType: r.shipmentType,
    status: r.status,
    quotedTotal: r.quotedTotal,
    chargesCurrency: r.chargesCurrency,
    updatedAt: r.updatedAt,
  }));
}
