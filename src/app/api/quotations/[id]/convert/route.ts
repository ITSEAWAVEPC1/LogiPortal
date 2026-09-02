import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatQuotationRef } from "@/lib/validation/quotation";

// CUSTOMER_APPROVED -> CONVERTED. Because a Quotation can bundle several
// Enquiries (see stage-3.md), this produces one JSON snapshot per attached
// Enquiry — not a single blob on the Quotation record — so Stage 4 can build
// one Job per Enquiry with zero re-entry. Every enquiry in the bundle shares
// the quotation's full line-item set (no per-shipment cost attribution is
// defined by the source process document); flagged for Stage 4 to confirm.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      organization: true,
      branch: { select: { id: true, name: true } },
      enquiries: {
        include: {
          enquiry: {
            include: { freightDetail: true, customsDetail: true, transportDetail: true },
          },
        },
      },
    },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status !== "CUSTOMER_APPROVED") {
    return NextResponse.json(
      { error: `A quotation must be Customer Approved before it can be converted to Jobs (current status: ${quotation.status})` },
      { status: 409 },
    );
  }

  const currentVersion = await prisma.quotationVersion.findUniqueOrThrow({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
  });
  const lineItems = await prisma.quotationLineItem.findMany({
    where: { quotationVersionId: currentVersion.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const quotationSnapshot = {
    id: quotation.id,
    ref: formatQuotationRef(quotation),
    versionNumber: currentVersion.versionNumber,
    currency: currentVersion.currency,
    totalAmount: currentVersion.totalAmount,
    approvedAt: currentVersion.approvedAt,
    branch: quotation.branch,
    lineItems,
  };
  const organizationSnapshot = quotation.organization;

  const convertedAt = new Date();
  const updated = await prisma.$transaction(
    async (tx) => {
      for (const qe of quotation.enquiries) {
        // Json columns need plain JSON-serializable values — round-tripping
        // through JSON.stringify/parse turns Date fields (createdAt, etc.)
        // into ISO strings instead of leaving them as Date instances.
        const jobSnapshot = JSON.parse(
          JSON.stringify({
            quotation: quotationSnapshot,
            organization: organizationSnapshot,
            enquiry: qe.enquiry,
          }),
        );
        await tx.quotationEnquiry.update({
          where: { id: qe.id },
          data: { convertedAt, jobSnapshot },
        });
      }
      return tx.quotation.update({ where: { id }, data: { status: "CONVERTED", convertedAt } });
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return NextResponse.json({ quotation: updated });
}
