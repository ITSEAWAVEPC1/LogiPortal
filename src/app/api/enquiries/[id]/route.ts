import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { enquiryAutosaveSchema } from "@/lib/validation/enquiry";

const DETAIL_INCLUDE = {
  organization: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  doer: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  freightDetail: true,
  customsDetail: true,
  transportDetail: true,
} as const;

const EDITABLE_STATUSES = ["DRAFT", "NEEDS_CORRECTION"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const enquiry = await prisma.enquiry.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ enquiry });
}

// Lenient autosave/edit — accepts partial/inconsistent draft state. Locked
// to DRAFT/NEEDS_CORRECTION for non-Admins so an OPEN or READY_FOR_QUOTATION
// enquiry can't be silently rewritten out from under the review queue.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role !== "ADMIN" && !EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
    return NextResponse.json({ error: `Cannot edit an enquiry with status ${existing.status}` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = enquiryAutosaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const enquiry = await prisma.$transaction(async (tx) => {
    const updated = await tx.enquiry.update({
      where: { id },
      data: {
        branchId: data.branchId,
        organizationId: data.organizationId,
        contactPersonName: data.contactPersonName,
        contactPersonPhone: data.contactPersonPhone,
        contactPersonEmail: data.contactPersonEmail,
        shipmentType: data.shipmentType,
        serviceTypes: data.serviceTypes,
        rfqReason: data.rfqReason,
      },
    });

    if (data.freightDetail) {
      await tx.enquiryFreightDetail.upsert({
        where: { enquiryId: id },
        create: { enquiryId: id, ...data.freightDetail },
        update: { ...data.freightDetail },
      });
    }
    if (data.customsDetail) {
      await tx.enquiryCustomsDetail.upsert({
        where: { enquiryId: id },
        create: { enquiryId: id, ...data.customsDetail },
        update: { ...data.customsDetail },
      });
    }
    if (data.transportDetail) {
      await tx.enquiryTransportDetail.upsert({
        where: { enquiryId: id },
        create: { enquiryId: id, ...data.transportDetail },
        update: { ...data.transportDetail },
      });
    }

    return updated;
  });

  return NextResponse.json({ enquiry });
}
