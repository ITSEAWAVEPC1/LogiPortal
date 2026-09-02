import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { stepActionSchema, validateStepData } from "@/lib/validation/workflow";
import { nextPendingAfter, priorStepsComplete } from "@/lib/workflow/engine";
import type { Prisma } from "@/generated/prisma/client";

const TX = { timeout: 20000, maxWait: 10000 } as const;

// Drive one workflow step. Authorization is per-step, not the coarse
// `workflowStatus` field-group perm: save/complete/submit need the step's
// ownerRole (or ADMIN); approve/reject need its approverRole (or ADMIN);
// revert is ADMIN only. Every mutating action appends exactly one
// JobAuditLog row inside the same transaction.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "jobs", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, stepId } = await params;
  const parsed = stepActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { action, data, note } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "WORKFLOW_IN_PROGRESS" && job.status !== "COMPLETED") {
    return NextResponse.json({ error: `Workflow is not active for a job with status ${job.status}` }, { status: 409 });
  }

  const rows = await prisma.jobWorkflowProgress.findMany({
    where: { jobId: id },
    orderBy: { sortOrder: "asc" },
    include: {
      step: { select: { ownerRole: true, approverRole: true, isApprovalGate: true, isFinal: true, isSkippable: true } },
    },
  });
  const target = rows.find((r) => r.id === stepId);
  if (!target) return NextResponse.json({ error: "Step not found for this job" }, { status: 404 });

  const isAdmin = role === "ADMIN";
  const ownerRole = target.step.ownerRole;
  const approverRole = target.step.approverRole;
  const isGate = target.step.isApprovalGate && !!approverRole;

  const writeAudit = (tx: Prisma.TransactionClient, auditAction: string, detail?: Prisma.InputJsonValue) =>
    tx.jobAuditLog.create({
      data: { jobId: id, actorId, action: auditAction, stepKey: target.stepKey, ...(detail ? { detail } : {}) },
    });

  // --- save / submit / complete: owner (or ADMIN) only ---------------------
  if (action === "save" || action === "submit" || action === "complete") {
    if (!isAdmin && role !== ownerRole) {
      return NextResponse.json({ error: `Only ${ownerRole} can work on this step` }, { status: 403 });
    }
    if (target.status === "COMPLETED") {
      return NextResponse.json({ error: "This step is already completed" }, { status: 409 });
    }
    if (!priorStepsComplete(rows, target)) {
      return NextResponse.json({ error: "An earlier step is not complete yet" }, { status: 409 });
    }

    const v = validateStepData(target.stepKey, data ?? target.data ?? {}, { strict: action !== "save" });
    if (!v.ok) {
      return NextResponse.json({ error: "Validation failed", issues: v.issues }, { status: 400 });
    }
    const stepData = v.data as Prisma.InputJsonValue;

    if (action === "save") {
      const updated = await prisma.jobWorkflowProgress.update({
        where: { id: stepId },
        data: { data: stepData, status: target.status === "PENDING" ? "IN_PROGRESS" : target.status },
      });
      return NextResponse.json({ progress: updated });
    }

    if (action === "submit") {
      if (!isGate) {
        return NextResponse.json({ error: "This step has no approval gate — use 'complete'" }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.jobWorkflowProgress.update({
          where: { id: stepId },
          data: { data: stepData, status: "PENDING_APPROVAL" },
        });
        await writeAudit(tx, "workflow.step.submitted", { data: stepData });
        return u;
      }, TX);
      return NextResponse.json({ progress: updated });
    }

    // action === "complete"
    if (isGate) {
      return NextResponse.json(
        { error: "This step needs approval — submit it for approval instead" },
        { status: 400 },
      );
    }
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.jobWorkflowProgress.update({
        where: { id: stepId },
        data: { data: stepData, status: "COMPLETED", completedById: actorId, completedAt: new Date() },
      });
      await writeAudit(tx, "workflow.step.completed", { data: stepData });
      const next = nextPendingAfter(rows, target.sortOrder);
      if (next) {
        await tx.jobWorkflowProgress.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } });
      }
      let jobCompleted = false;
      if (target.step.isFinal && job.status !== "COMPLETED") {
        await tx.job.update({ where: { id }, data: { status: "COMPLETED" } });
        await tx.jobAuditLog.create({ data: { jobId: id, actorId, action: "job.completed", stepKey: target.stepKey } });
        jobCompleted = true;
      }
      return { progress: u, jobCompleted };
    }, TX);
    return NextResponse.json(result);
  }

  // --- skip: owner (or ADMIN) only, and only on an isSkippable step --------
  if (action === "skip") {
    if (!target.step.isSkippable) {
      return NextResponse.json({ error: "This step cannot be skipped" }, { status: 400 });
    }
    if (!isAdmin && role !== ownerRole) {
      return NextResponse.json({ error: `Only ${ownerRole} can skip this step` }, { status: 403 });
    }
    if (target.status !== "PENDING" && target.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: `Cannot skip a step that is ${target.status}` }, { status: 409 });
    }
    if (!priorStepsComplete(rows, target)) {
      return NextResponse.json({ error: "An earlier step is not complete yet" }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // completedById/completedAt stay null — nobody completed it, they
      // recorded that it doesn't apply to this shipment.
      const u = await tx.jobWorkflowProgress.update({
        where: { id: stepId },
        data: { status: "SKIPPED" },
      });
      await writeAudit(tx, "workflow.step.skipped", note ? { note } : undefined);
      const next = nextPendingAfter(rows, target.sortOrder);
      if (next) {
        await tx.jobWorkflowProgress.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } });
      }
      return u;
    }, TX);
    return NextResponse.json({ progress: result });
  }

  // --- approve / reject: approverRole (or ADMIN) only ---------------------
  if (action === "approve" || action === "reject") {
    if (!isGate) {
      return NextResponse.json({ error: "This step has no approval gate" }, { status: 400 });
    }
    if (!isAdmin && role !== approverRole) {
      return NextResponse.json({ error: `Only ${approverRole} can review this step` }, { status: 403 });
    }
    if (target.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: `Cannot ${action} a step that is ${target.status}` }, { status: 409 });
    }
    if (action === "reject" && !note) {
      return NextResponse.json({ error: "A note is required when rejecting a step" }, { status: 400 });
    }

    if (action === "approve") {
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.jobWorkflowProgress.update({
          where: { id: stepId },
          data: { status: "COMPLETED", approvedById: actorId, approvedAt: new Date(), reviewNote: null },
        });
        await writeAudit(tx, "workflow.step.approved", note ? { note } : undefined);
        const next = nextPendingAfter(rows, target.sortOrder);
        if (next) {
          await tx.jobWorkflowProgress.update({ where: { id: next.id }, data: { status: "IN_PROGRESS" } });
        }
        return u;
      }, TX);
      return NextResponse.json({ progress: updated });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.jobWorkflowProgress.update({
        where: { id: stepId },
        data: { status: "IN_PROGRESS", reviewNote: note },
      });
      await writeAudit(tx, "workflow.step.rejected", { note: note as string });
      return u;
    }, TX);
    return NextResponse.json({ progress: updated });
  }

  // --- revert: ADMIN only -------------------------------------------------
  if (action === "revert") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Only an Admin can revert a completed or skipped step" }, { status: 403 });
    }
    if (target.status !== "COMPLETED" && target.status !== "SKIPPED") {
      return NextResponse.json({ error: "Only a completed or skipped step can be reverted" }, { status: 409 });
    }
    if (!note) {
      return NextResponse.json({ error: "A note is required when reverting a step" }, { status: 400 });
    }
    const revertedFrom = target.status;
    const laterIds = rows.filter((r) => r.sortOrder > target.sortOrder).map((r) => r.id);

    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.jobWorkflowProgress.update({
        where: { id: stepId },
        data: {
          status: "IN_PROGRESS",
          completedById: null,
          completedAt: null,
          approvedById: null,
          approvedAt: null,
          reviewNote: note,
        },
      });
      if (laterIds.length) {
        await tx.jobWorkflowProgress.updateMany({
          where: { id: { in: laterIds } },
          data: {
            status: "PENDING",
            completedById: null,
            completedAt: null,
            approvedById: null,
            approvedAt: null,
            reviewNote: null,
          },
        });
      }
      let jobReopened = false;
      if (job.status === "COMPLETED") {
        await tx.job.update({ where: { id }, data: { status: "WORKFLOW_IN_PROGRESS" } });
        jobReopened = true;
      }
      await writeAudit(tx, "workflow.step.reverted", {
        from: revertedFrom,
        to: "IN_PROGRESS",
        note,
        laterStepsReset: laterIds.length,
      });
      return { progress: u, jobReopened };
    }, TX);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
