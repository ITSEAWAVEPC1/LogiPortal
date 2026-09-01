import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatEnquiryRef } from "@/lib/validation/enquiry";

// Lists the per-enquiry rows of a CONVERTED quotation so the New Job screen
// can offer "create one Job per enquiry" — flagging any that already have one.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quotationId = new URL(request.url).searchParams.get("quotationId");
  if (!quotationId) return NextResponse.json({ error: "quotationId is required" }, { status: 400 });

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      organization: { select: { id: true, name: true } },
      enquiries: {
        include: {
          enquiry: { select: { sequenceNumber: true, createdAt: true, shipmentType: true, serviceTypes: true } },
          job: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quotation.status !== "CONVERTED") {
    return NextResponse.json({ error: `Quotation is not converted (status: ${quotation.status})` }, { status: 409 });
  }

  return NextResponse.json({
    organization: quotation.organization,
    rows: quotation.enquiries.map((qe) => ({
      quotationEnquiryId: qe.id,
      enquiryRef: formatEnquiryRef(qe.enquiry.createdAt, qe.enquiry.sequenceNumber),
      shipmentType: qe.enquiry.shipmentType,
      serviceTypes: qe.enquiry.serviceTypes,
      jobId: qe.job?.id ?? null,
    })),
  });
}
