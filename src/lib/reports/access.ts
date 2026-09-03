// Stage 10b — which roles may see which report (plan §4.2). Layered on top of
// access-matrix's boolean `reports` screen visibility (ADMIN, BRANCH_MANAGER,
// SALES, ACCOUNTS) and scope.ts's row-scoping (`reportScope`).

import type { Role } from "@/lib/permissions/roles";

export const REPORT_KEYS = [
  "branch-performance",
  "pending-ageing",
  "revenue",
  "conversion",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_META: Record<ReportKey, { title: string; description: string }> = {
  "branch-performance": {
    title: "Branch performance",
    description: "Jobs created, delivered, on-time %, and revenue per branch for the period.",
  },
  "pending-ageing": {
    title: "Pending & ageing shipments",
    description: "Open jobs by current workflow stage, days in stage, and overdue flag.",
  },
  revenue: {
    title: "Revenue",
    description: "Quoted vs converted revenue, broken down by branch, customer, service type, and month.",
  },
  conversion: {
    title: "Conversion funnel",
    description: "Enquiry → quotation → job conversion and quotation win-rate over time.",
  },
};

// branch-performance / pending-ageing / revenue: ADMIN, BRANCH_MANAGER, ACCOUNTS.
// conversion additionally: SALES (their only report, scoped to their own records).
const REPORT_ROLES: Record<ReportKey, ReadonlySet<Role>> = {
  "branch-performance": new Set<Role>(["ADMIN", "BRANCH_MANAGER", "ACCOUNTS"]),
  "pending-ageing": new Set<Role>(["ADMIN", "BRANCH_MANAGER", "ACCOUNTS"]),
  revenue: new Set<Role>(["ADMIN", "BRANCH_MANAGER", "ACCOUNTS"]),
  conversion: new Set<Role>(["ADMIN", "BRANCH_MANAGER", "ACCOUNTS", "SALES"]),
};

export function isReportKey(v: string): v is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(v);
}

export function canSeeReport(role: Role, key: ReportKey): boolean {
  return REPORT_ROLES[key].has(role);
}

export function visibleReports(role: Role): ReportKey[] {
  return REPORT_KEYS.filter((k) => canSeeReport(role, k));
}
