import type { Scope } from "@/lib/permissions/scope";
import type { ReportKey } from "./access";
import type { ReportFilters, ReportResult } from "./types";
import { branchPerformanceReport } from "./branch-performance";
import { pendingAgeingReport } from "./pending-ageing";
import { revenueReport } from "./revenue";
import { conversionReport } from "./conversion";

const RUNNERS: Record<ReportKey, (scope: Scope, filters: ReportFilters) => Promise<ReportResult>> = {
  "branch-performance": branchPerformanceReport,
  "pending-ageing": pendingAgeingReport,
  revenue: revenueReport,
  conversion: conversionReport,
};

export function runReport(
  key: ReportKey,
  scope: Scope,
  filters: ReportFilters,
): Promise<ReportResult> {
  return RUNNERS[key](scope, filters);
}

export * from "./access";
export * from "./period";
export type { ReportFilters, ReportResult, ReportTable, ReportChart } from "./types";
