import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const reviewSchema = z.object({
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().optional(),
});

// Branch Manager's final-review gate: PENDING_REVIEW -> WORKFLOW_IN_PROGRESS or
// NEEDS_CORRECTION. Incoterm on the approved Job selects the Stage 5/6
// workflow template.
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

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: parsed.data.decision === "approve" ? "WORKFLOW_IN_PROGRESS" : "NEEDS_CORRECTION",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ job: updated });
}
