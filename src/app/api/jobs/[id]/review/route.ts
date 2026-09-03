import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { attachWorkflow } from "@/lib/workflow/engine";
import { formatJobRef } from "@/lib/validation/job";
import { fireAfterResponse } from "@/lib/notifications/fire";
import { jobWorkflowStarted } from "@/lib/notifications/events";

const reviewSchema = z.object({
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().optional(),
});

// Branch Manager's final-review gate: PENDING_REVIEW -> WORKFLOW_IN_PROGRESS or
// NEEDS_CORRECTION. On approve, the Incoterm (+ exportStuffingType for Export)
// on the Job selects a Stage 5/6 workflow template and its steps are copied
// onto the Job (attachWorkflow) in the same transaction — a Job whose
// Incoterm/stuffing combination has no matching template simply gets no
// steps.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.decision === "needs_correction" && !parsed.data.note) {
    return NextResponse.json({ error: "A note is required when flagging a job back for correction" }, { status: 400 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: `Cannot review a job with status ${job.status}` }, { status: 409 });
  }

  if (parsed.data.decision === "needs_correction") {
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: "NEEDS_CORRECTION",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
      },
    });
    return NextResponse.json({ job: updated });
  }

  const { job: updated, workflow } = await prisma.$transaction(
    async (tx) => {
      const u = await tx.job.update({
        where: { id },
        data: {
          status: "WORKFLOW_IN_PROGRESS",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note ?? null,
        },
      });
      const attach = await attachWorkflow(
        tx,
        { id: u.id, shipmentType: u.shipmentType, incoterm: u.incoterm, exportStuffingType: u.exportStuffingType },
        session.user.id,
      );
      return { job: u, workflow: attach };
    },
    { timeout: 20000, maxWait: 10000 },
  );

  fireAfterResponse(
    await jobWorkflowStarted({
      jobId: id,
      jobRef: formatJobRef(job),
      branchId: job.branchId,
      jobCreatedById: job.createdById,
      actorId: session.user.id,
    }),
  );

  return NextResponse.json({ job: updated, workflow });
}
