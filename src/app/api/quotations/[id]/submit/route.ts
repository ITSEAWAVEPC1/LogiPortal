import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { fireAfterResponse } from "@/lib/notifications/fire";
import { quotationSubmitted } from "@/lib/notifications/events";

// Strict submit transition, DRAFT|NEEDS_CORRECTION -> PENDING_APPROVAL.
// Re-validates from the DB's current state (the current version must have
// at least one line item) rather than trusting the request body.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status !== "DRAFT" && quotation.status !== "NEEDS_CORRECTION") {
    return NextResponse.json({ error: `Cannot submit a quotation with status ${quotation.status}` }, { status: 409 });
  }

  const currentVersion = await prisma.quotationVersion.findUnique({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
    include: { _count: { select: { lineItems: true } } },
  });
  if (!currentVersion || currentVersion._count.lineItems === 0) {
    return NextResponse.json({ error: "Add at least one charge line item before submitting" }, { status: 400 });
  }

  const updated = await prisma.quotation.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });

  fireAfterResponse(
    await quotationSubmitted({
      quotationId: id,
      quotationRef: formatQuotationRef(quotation),
      branchId: quotation.branchId,
      actorId: session.user.id,
    }),
  );

  return NextResponse.json({ quotation: updated });
}
