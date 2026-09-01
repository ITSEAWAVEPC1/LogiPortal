import type { Prisma, ShipmentType } from "@/generated/prisma/client";
import { normalizeIncotermKey } from "./import-tracks";

// Stage 5 — workflow attach + transition helpers. Kept transaction-client
// parameterized so the review route can attach inside its existing
// $transaction, and pure where possible so the step route can orchestrate.

export interface AttachableJob {
  id: string;
  shipmentType: ShipmentType;
  incoterm: string | null;
}

export interface AttachResult {
  attached: boolean;
  templateId?: string;
  templateName?: string;
  stepCount?: number;
  reason?: "already-attached" | "no-template";
}

/**
 * Copies the active steps of the WorkflowTemplate matching
 * (job.shipmentType, normalized job.incoterm) into JobWorkflowProgress rows —
 * lowest sortOrder IN_PROGRESS, the rest PENDING — and appends a
 * "workflow.attached" JobAuditLog row. No-op (attached:false) when the Job
 * already has progress rows or no active template matches its Incoterm
 * (stage-5.md decision #1). Called from the review route's approve branch.
 */
export async function attachWorkflow(
  tx: Prisma.TransactionClient,
  job: AttachableJob,
  actorId: string,
): Promise<AttachResult> {
  const existing = await tx.jobWorkflowProgress.count({ where: { jobId: job.id } });
  if (existing > 0) return { attached: false, reason: "already-attached" };

  const template = await tx.workflowTemplate.findFirst({
    where: {
      shipmentType: job.shipmentType,
      incotermKey: normalizeIncotermKey(job.incoterm),
      isActive: true,
    },
    include: { steps: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!template || template.steps.length === 0) return { attached: false, reason: "no-template" };

  await tx.jobWorkflowProgress.createMany({
    data: template.steps.map((step, i) => ({
      jobId: job.id,
      templateId: template.id,
      stepId: step.id,
      stepKey: step.stepKey,
      label: step.label,
      sortOrder: step.sortOrder,
      status: i === 0 ? ("IN_PROGRESS" as const) : ("PENDING" as const),
    })),
  });

  await tx.jobAuditLog.create({
    data: {
      jobId: job.id,
      actorId,
      action: "workflow.attached",
      detail: {
        templateId: template.id,
        templateName: template.name,
        incotermKey: template.incotermKey,
        stepCount: template.steps.length,
      },
    },
  });

  return {
    attached: true,
    templateId: template.id,
    templateName: template.name,
    stepCount: template.steps.length,
  };
}

// --- pure sequencing helpers (used by the step route) --------------------

export interface ProgressLike {
  id: string;
  sortOrder: number;
  status: "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETED" | "SKIPPED";
}

const DONE = new Set(["COMPLETED", "SKIPPED"]);

/** The row a user can currently act on: lowest sortOrder that isn't done. */
export function currentActionableStep<T extends ProgressLike>(rows: T[]): T | null {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder).find((r) => !DONE.has(r.status)) ?? null;
}

/** True when every row ordered before `target` is done. */
export function priorStepsComplete(rows: ProgressLike[], target: ProgressLike): boolean {
  return rows.every((r) => r.sortOrder >= target.sortOrder || DONE.has(r.status));
}

/** The next PENDING row after `sortOrder`, or null if none remain. */
export function nextPendingAfter<T extends ProgressLike>(rows: T[], sortOrder: number): T | null {
  return (
    [...rows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((r) => r.sortOrder > sortOrder && r.status === "PENDING") ?? null
  );
}
