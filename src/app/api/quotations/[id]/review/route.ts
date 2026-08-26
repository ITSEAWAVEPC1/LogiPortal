import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { reviewSchema } from "@/lib/validation/quotation";

// Branch Manager's approval gate: PENDING_APPROVAL -> APPROVED or
// NEEDS_CORRECTION. On approve, also stamps the *version* (approvedById/At)
// so approval history survives future versions cloned off it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.decision === "needs_correction" && !parsed.data.note) {
    return NextResponse.json(
      { error: "A note is required when flagging a quotation back for correction" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quotation.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: `Cannot review a quotation with status ${quotation.status}` }, { status: 409 });
  }

  const approve = parsed.data.decision === "approve";

  const updated = await prisma.$transaction(async (tx) => {
    if (approve) {
      await tx.quotationVersion.update({
        where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
        data: { approvedById: session.user.id, approvedAt: new Date() },
      });
    }
    return tx.quotation.update({
      where: { id },
      data: {
        status: approve ? "APPROVED" : "NEEDS_CORRECTION",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
      },
    });
  });

  return NextResponse.json({ quotation: updated });
}
