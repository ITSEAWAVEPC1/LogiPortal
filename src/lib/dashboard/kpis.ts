// Stage 10b — CXO KPI band (ADMIN + BRANCH_MANAGER). Job-creation count,
// on-time %, and revenue for a chosen period (YTD / MTD / WTD / custom range).

import { prisma } from "@/lib/db/prisma";
import { jobScopeWhere, type Scope } from "@/lib/permissions/scope";
import { onTimeRate } from "@/lib/reports/common";
import type { Period } from "@/lib/reports/period";

export interface CxoKpis {
  jobsCreated: number;
  jobsDelivered: number;
  onTimeRate: number | null;
  revenue: number;
  periodKey: string;
  periodLabel: string;
}

export async function getCxoKpis(scope: Scope, period: Period): Promise<CxoKpis> {
  const base = jobScopeWhere(scope);
  const [created, delivered] = await Promise.all([
    prisma.job.aggregate({
      _count: { _all: true },
      _sum: { quotedTotal: true },
      where: { ...base, createdAt: { gte: period.gte, lt: period.lt } },
    }),
    prisma.job.findMany({
      where: { ...base, actualDeliveryDate: { gte: period.gte, lt: period.lt } },
      select: { expectedDeliveryDate: true, actualDeliveryDate: true },
    }),
  ]);

  return {
    jobsCreated: created._count._all,
    jobsDelivered: delivered.length,
    onTimeRate: onTimeRate(delivered),
    revenue: created._sum.quotedTotal ?? 0,
    periodKey: period.key,
    periodLabel: period.label,
  };
}
