import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { fireAfterResponse } from "@/lib/notifications/fire";
import { quotationReviewed, quotationSent } from "@/lib/notifications/events";

// Stage 14b — QUOTATION_PREPARED -> APPROVED. No Branch Manager gate: the
// internal preparer (quotations.edit) marks the quote final. On approve we
// also stamp the current QuotationVersion's approvedBy/approvedAt — /convert
// copies that into the per-enquiry jobSnapshot and the Quotation PDF renders
// it ("Approved {date}"). The customer is notified and the quote surfaces in
// the portal at this point (quotationSent); there is no separate customer
// sign-off step.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status !== "QUOTATION_PREPARED") {
    return NextResponse.json(
      { error: `Only a Quotation Prepared quotation can be approved (current status: ${quotation.status})` },
      { status: 409 },
    );
  }

  const currentVersion = await prisma.quotationVersion.findUnique({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
    include: { _count: { select: { lineItems: true } } },
  });
  if (!currentVersion || currentVersion._count.lineItems === 0) {
    return NextResponse.json({ error: "Add at least one charge line item before approving" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quotationVersion.update({
      where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
      data: { approvedById: session.user.id, approvedAt: new Date() },
    });
    return tx.quotation.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
  });

  fireAfterResponse([
    ...quotationReviewed({
      quotationId: id,
      quotationRef: formatQuotationRef(quotation),
      decision: "approved",
      createdById: quotation.createdById,
      actorId: session.user.id,
    }),
    ...(await quotationSent({
      quotationId: id,
      quotationRef: formatQuotationRef(quotation),
      organizationId: quotation.organizationId,
      createdById: quotation.createdById,
      actorId: session.user.id,
    })),
  ]);

  return NextResponse.json({ quotation: updated });
}
