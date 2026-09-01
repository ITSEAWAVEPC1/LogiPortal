import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getJobFieldAccess } from "@/lib/permissions/job-fields";
import { stepFieldDefs } from "@/lib/validation/workflow";
import { currentActionableStep } from "@/lib/workflow/engine";

// Read the workflow state of a Job: its attached template, ordered step
// progress (with per-step field defs + owner/approver/gate), and the
// append-only audit trail. `attached: false` for Jobs that predate Stage 5 or
// whose Incoterm has no seeded Import template.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (!can(role, "jobs", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const access = await getJobFieldAccess(role);
  if (access.workflowStatus === "NONE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      shipmentType: true,
      incoterm: true,
      portOfLoading: true,
      portOfDischarge: true,
      shipperDetail: { select: { name: true } },
      consigneeDetail: { select: { name: true } },
      workflowProgress: {
        orderBy: { sortOrder: "asc" },
        include: {
          step: { select: { ownerRole: true, approverRole: true, isApprovalGate: true } },
          completedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templateId = job.workflowProgress[0]?.templateId ?? null;
  const template = templateId
    ? await prisma.workflowTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, incotermKey: true },
      })
    : null;

  const prefillValue = (key: string): string | null => {
    switch (key) {
      case "shipperName":
        return job.shipperDetail?.name ?? null;
      case "consigneeName":
        return job.consigneeDetail?.name ?? null;
      case "portOfLoading":
        return job.portOfLoading ?? null;
      case "portOfDischarge":
        return job.portOfDischarge ?? null;
      default:
        return null;
    }
  };

  const progress = job.workflowProgress.map((p) => {
    const fields = stepFieldDefs(p.stepKey);
    let data = (p.data ?? null) as Record<string, unknown> | null;
    if (!data) {
      const pre: Record<string, unknown> = {};
      for (const f of fields) {
        if (!f.prefillFrom) continue;
        const v = prefillValue(f.prefillFrom);
        if (v) pre[f.key] = v;
      }
      if (Object.keys(pre).length) data = pre;
    }
    return {
      id: p.id,
      stepKey: p.stepKey,
      label: p.label,
      sortOrder: p.sortOrder,
      status: p.status,
      data,
      fields,
      ownerRole: p.step.ownerRole,
      approverRole: p.step.approverRole,
      isApprovalGate: p.step.isApprovalGate,
      completedBy: p.completedBy,
      completedAt: p.completedAt,
      approvedBy: p.approvedBy,
      approvedAt: p.approvedAt,
      reviewNote: p.reviewNote,
    };
  });

  const current = currentActionableStep(progress);

  return NextResponse.json({
    attached: progress.length > 0,
    job: { id: job.id, status: job.status, shipmentType: job.shipmentType, incoterm: job.incoterm },
    template,
    progress,
    auditLog: job.auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      stepKey: a.stepKey,
      detail: a.detail,
      createdAt: a.createdAt,
      actor: a.actor,
    })),
    currentStepId: current?.id ?? null,
    viewerRole: role,
    canManageTemplates: can(role, "workflowTemplates", "edit"),
  });
}
