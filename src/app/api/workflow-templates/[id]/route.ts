import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { templatePatchSchema } from "@/lib/validation/workflow";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workflowTemplates", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const template = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { sortOrder: "asc" } }, _count: { select: { jobProgress: true } } },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

// Diff-based edit of a template + its steps. Steps are matched by `id`
// (updated in place); an entry with no `id` inserts a new step; steps not
// mentioned are left untouched; there is NO delete — set `isActive:false`.
// Diff, not replace-children, because JobWorkflowProgress.stepId FKs these
// rows. An admin edit only affects Jobs attached *afterward* — in-flight
// Jobs carry a denormalized snapshot.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workflowTemplates", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = templatePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const template = await prisma.workflowTemplate.findUnique({ where: { id }, include: { steps: true } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, isActive, steps } = parsed.data;
  const existingById = new Map(template.steps.map((s) => [s.id, s]));
  const existingKeys = new Set(template.steps.map((s) => s.stepKey));

  // Validate every step entry up front (nothing partially applied).
  for (const sp of steps ?? []) {
    if (sp.id) {
      if (!existingById.has(sp.id)) {
        return NextResponse.json({ error: `Step ${sp.id} does not belong to this template` }, { status: 400 });
      }
    } else {
      if (!sp.stepKey || !sp.label || sp.sortOrder === undefined || !sp.ownerRole) {
        return NextResponse.json(
          { error: "A new step needs stepKey, label, sortOrder and ownerRole" },
          { status: 400 },
        );
      }
      if (existingKeys.has(sp.stepKey)) {
        return NextResponse.json({ error: `Step key "${sp.stepKey}" already exists on this template` }, { status: 409 });
      }
    }
    const resolvedApprover =
      sp.approverRole !== undefined ? sp.approverRole : (sp.id ? existingById.get(sp.id)!.approverRole : null);
    if (sp.isApprovalGate === true && !resolvedApprover) {
      return NextResponse.json({ error: "An approval gate needs an approver role" }, { status: 400 });
    }
  }

  await prisma.$transaction(
    async (tx) => {
      if (name !== undefined || isActive !== undefined) {
        await tx.workflowTemplate.update({
          where: { id },
          data: { ...(name !== undefined ? { name } : {}), ...(isActive !== undefined ? { isActive } : {}) },
        });
      }

      for (const sp of steps ?? []) {
        if (sp.id) {
          const current = existingById.get(sp.id)!;
          const approverRole =
            sp.approverRole !== undefined ? sp.approverRole : current.approverRole;
          const data: Prisma.WorkflowStepUpdateInput = {
            // Keep the gate flag coherent with the approver: gate iff approver set.
            isApprovalGate: Boolean(approverRole),
            approverRole: approverRole ?? null,
          };
          if (sp.label !== undefined) data.label = sp.label;
          if (sp.sortOrder !== undefined) data.sortOrder = sp.sortOrder;
          if (sp.ownerRole !== undefined) data.ownerRole = sp.ownerRole;
          if (sp.isActive !== undefined) data.isActive = sp.isActive;
          await tx.workflowStep.update({ where: { id: sp.id }, data });
        } else {
          await tx.workflowStep.create({
            data: {
              templateId: id,
              stepKey: sp.stepKey!,
              label: sp.label!,
              sortOrder: sp.sortOrder!,
              ownerRole: sp.ownerRole!,
              approverRole: sp.approverRole ?? null,
              isApprovalGate: Boolean(sp.approverRole),
            },
          });
        }
      }

      // Stage 6 — isFinal must always be exactly the active step with the
      // highest sortOrder, not just whatever the seed set once (an admin can
      // reorder/insert/deactivate steps after seeding). Recompute on every
      // edit rather than trusting the seed-time value.
      const [lastActive] = await tx.workflowStep.findMany({
        where: { templateId: id, isActive: true },
        orderBy: { sortOrder: "desc" },
        take: 1,
        select: { id: true, isFinal: true },
      });
      await tx.workflowStep.updateMany({
        where: { templateId: id, isFinal: true, ...(lastActive ? { id: { not: lastActive.id } } : {}) },
        data: { isFinal: false },
      });
      if (lastActive && !lastActive.isFinal) {
        await tx.workflowStep.update({ where: { id: lastActive.id }, data: { isFinal: true } });
      }
    },
    { timeout: 20000, maxWait: 10000 },
  );

  const updated = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { sortOrder: "asc" } }, _count: { select: { jobProgress: true } } },
  });
  return NextResponse.json({ template: updated });
}
