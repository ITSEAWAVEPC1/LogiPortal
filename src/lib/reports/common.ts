// Stage 10b — helpers shared by two or more report query modules.
import { prisma } from "@/lib/db/prisma";
import { NO_BRANCH, type Scope } from "@/lib/permissions/scope";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * The set of branch ids a report may cover: the scope's branches intersected
 * with an optional ADMIN-supplied `branchId` filter. Returns `null` for "all
 * branches" (only possible for an ALL scope with no filter).
 */
export function resolveReportBranchIds(scope: Scope, branchIdFilter?: string): string[] | null {
  if (scope.kind === "BRANCH") {
    const ids = scope.branchIds.length ? scope.branchIds : [NO_BRANCH];
    if (branchIdFilter) return ids.includes(branchIdFilter) ? [branchIdFilter] : [NO_BRANCH];
    return ids;
  }
  // ALL (OWN never reaches these reports)
  return branchIdFilter ? [branchIdFilter] : null;
}

/** `{ branchId: { in } }` fragment, or `{}` for all branches. */
export function branchWhere(branchIds: string[] | null): { branchId?: { in: string[] } } {
  return branchIds ? { branchId: { in: branchIds } } : {};
}

export interface ReportBranch {
  id: string;
  name: string;
}

/** In-scope active branches, name-ordered — the row skeleton for per-branch reports. */
export async function listReportBranches(branchIds: string[] | null): Promise<ReportBranch[]> {
  return prisma.branch.findMany({
    where: { isActive: true, ...(branchIds ? { id: { in: branchIds } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** On-time rate over jobs that have BOTH delivery dates set. null when none do. */
export function onTimeRate(
  jobs: Array<{ expectedDeliveryDate: Date | null; actualDeliveryDate: Date | null }>,
): number | null {
  const withBoth = jobs.filter((j) => j.expectedDeliveryDate && j.actualDeliveryDate);
  if (withBoth.length === 0) return null;
  const onTime = withBoth.filter(
    (j) => j.actualDeliveryDate!.getTime() <= j.expectedDeliveryDate!.getTime(),
  ).length;
  return onTime / withBoth.length;
}

export function pct(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}
