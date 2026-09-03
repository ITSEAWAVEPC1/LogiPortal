import { prisma } from "@/lib/db/prisma";
import { jobScopeWhere, type Scope } from "@/lib/permissions/scope";
import { currentActionableStep } from "@/lib/workflow/engine";
import { formatJobRef } from "@/lib/validation/job";
import { branchWhere, resolveReportBranchIds } from "./common";
import type { ReportFilters, ReportResult } from "./types";

const OPEN_STATUSES = ["WORKFLOW_IN_PROGRESS", "PENDING_REVIEW", "NEEDS_CORRECTION"] as const;
const DAY_MS = 86_400_000;

// Every open job, with its current workflow stage, how long it has sat there,
// and whether it is past its expected delivery date. Not period-bounded — this
// is a live snapshot (the period filter is ignored, noted on the page).
export async function pendingAgeingReport(scope: Scope, filters: ReportFilters): Promise<ReportResult> {
  const branchIds = resolveReportBranchIds(scope, filters.branchId);

  const jobs = await prisma.job.findMany({
    where: {
      ...jobScopeWhere(scope),
      ...branchWhere(branchIds),
      status: { in: [...OPEN_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      referenceNo: true,
      sequenceNumber: true,
      createdAt: true,
      status: true,
      shipmentType: true,
      expectedDeliveryDate: true,
      actualDeliveryDate: true,
      organization: { select: { name: true } },
      branch: { select: { name: true } },
      workflowProgress: {
        select: { id: true, sortOrder: true, status: true, label: true, updatedAt: true },
      },
    },
  });

  const now = Date.now();
  const rows = jobs.map((j) => {
    const step = currentActionableStep(j.workflowProgress);
    const since = step?.updatedAt ?? j.createdAt;
    const overdue =
      !!j.expectedDeliveryDate && !j.actualDeliveryDate && j.expectedDeliveryDate.getTime() < now;
    return {
      reference: formatJobRef({
        referenceNo: j.referenceNo,
        createdAt: j.createdAt,
        sequenceNumber: j.sequenceNumber,
      }),
      customer: j.organization.name,
      branch: j.branch.name,
      type: j.shipmentType,
      stage: step?.label ?? j.status.replace(/_/g, " "),
      daysInStage: Math.max(0, Math.floor((now - since.getTime()) / DAY_MS)),
      expected: j.expectedDeliveryDate ? j.expectedDeliveryDate.toISOString().slice(0, 10) : "—",
      overdue: overdue ? "Yes" : "",
    };
  });

  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);

  return {
    table: {
      columns: [
        { key: "reference", header: "Reference" },
        { key: "customer", header: "Customer" },
        { key: "branch", header: "Branch" },
        { key: "type", header: "Type" },
        { key: "stage", header: "Current stage" },
        { key: "daysInStage", header: "Days in stage", numeric: true },
        { key: "expected", header: "Expected delivery" },
        { key: "overdue", header: "Overdue" },
      ],
      rows,
      total: {
        reference: `${rows.length} open`,
        overdue: `${rows.filter((r) => r.overdue === "Yes").length} overdue`,
      },
    },
    chart: {
      kind: "bar",
      xKey: "stage",
      data: [...byStage.entries()].map(([stage, count]) => ({ stage, count })),
      series: [{ key: "count", label: "Open jobs", color: "var(--chart-2)" }],
    },
  };
}
