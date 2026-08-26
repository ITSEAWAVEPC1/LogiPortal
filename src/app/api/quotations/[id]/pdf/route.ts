import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { renderQuotationPdf } from "@/lib/pdf/render-quotation-pdf";
import type { QuotationPdfData } from "@/lib/pdf/types";

// Streams a PDF via @react-pdf/renderer. On render failure, returns
// { fallback: true, data } with a 200 (not a hard error) so the client can
// render the exact same data through QuotationHtmlPreview instead — this is
// the stage's explicit "PDF failure falls back to HTML preview" requirement.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, city: true, state: true } },
      branch: { select: { name: true } },
      createdBy: { select: { name: true } },
      enquiries: { include: { enquiry: { select: { id: true, createdAt: true, sequenceNumber: true, shipmentType: true, serviceTypes: true } } } },
    },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentVersion = await prisma.quotationVersion.findUnique({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
  });
  const lineItems = currentVersion
    ? await prisma.quotationLineItem.findMany({
        where: { quotationVersionId: currentVersion.id },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const data: QuotationPdfData = {
    id: quotation.id,
    ref: formatQuotationRef(quotation.createdAt, quotation.sequenceNumber),
    status: quotation.status,
    organizationName: quotation.organization.name,
    organizationCity: quotation.organization.city,
    organizationState: quotation.organization.state,
    branchName: quotation.branch.name,
    createdByName: quotation.createdBy.name,
    createdAt: quotation.createdAt.toISOString(),
    versionNumber: currentVersion?.versionNumber ?? quotation.currentVersionNumber,
    currency: currentVersion?.currency ?? "INR",
    totalAmount: currentVersion?.totalAmount ?? 0,
    approvedAt: currentVersion?.approvedAt?.toISOString() ?? null,
    enquiries: quotation.enquiries.map((qe) => ({
      id: qe.enquiry.id,
      ref: formatEnquiryRef(qe.enquiry.createdAt, qe.enquiry.sequenceNumber),
      shipmentType: qe.enquiry.shipmentType,
      serviceTypes: qe.enquiry.serviceTypes,
    })),
    lineItems: lineItems.map((li) => ({
      id: li.id,
      category: li.category,
      description: li.description,
      rate: li.rate,
      quantity: li.quantity,
      amount: li.amount,
      currency: li.currency,
    })),
  };

  try {
    const buffer = await renderQuotationPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.ref}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ fallback: true, data }, { status: 200 });
  }
}
