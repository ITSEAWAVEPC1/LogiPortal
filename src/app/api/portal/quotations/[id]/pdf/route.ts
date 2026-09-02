import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getPortalApiContext, logPortalAccess } from "@/lib/portal/guard";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { renderQuotationPdf } from "@/lib/pdf/render-quotation-pdf";
import type { QuotationPdfData } from "@/lib/pdf/types";

// Stage 9 — isolated, read-only customer quotation PDF. Only for a quotation
// that belongs to the caller's organization. Reuses the shared PDF renderer
// lib (not the internal route). Same HTML-preview failover as Stage 3.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await getPortalApiContext();
  if (!guard.ok) return guard.response;
  const { userId, orgId } = guard;

  const { id } = await params;
  const path = `/api/portal/quotations/${id}/pdf`;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, city: true, state: true } },
      branch: { select: { name: true } },
      createdBy: { select: { name: true } },
      enquiries: {
        include: {
          enquiry: {
            select: {
              id: true,
              createdAt: true,
              sequenceNumber: true,
              referenceNo: true,
              shipmentType: true,
              serviceTypes: true,
            },
          },
        },
      },
    },
  });

  if (!quotation || quotation.organizationId !== orgId) {
    await logPortalAccess({
      userId,
      viewerOrgId: orgId,
      path,
      resourceType: "quotation",
      resourceId: id,
      outcome: !quotation ? "DENIED_NOT_FOUND" : orgId === null ? "DENIED_UNLINKED" : "DENIED_CROSS_ORG",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    ref: formatQuotationRef(quotation),
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
      ref: formatEnquiryRef(qe.enquiry),
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
