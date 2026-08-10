import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { enquirySubmitSchema } from "@/lib/validation/enquiry";

// Strict submit transition, DRAFT|NEEDS_CORRECTION -> OPEN. Always
// re-validates from the DB's current state rather than trusting the request
// body — same "never trust client-computed validity" precedent as Stage 1's
// bulk-import commit route.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: { freightDetail: true, customsDetail: true, transportDetail: true },
  });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (enquiry.status !== "DRAFT" && enquiry.status !== "NEEDS_CORRECTION") {
    return NextResponse.json({ error: `Cannot submit an enquiry with status ${enquiry.status}` }, { status: 409 });
  }

  const parsed = enquirySubmitSchema.safeParse({
    branchId: enquiry.branchId,
    organizationId: enquiry.organizationId,
    contactPersonName: enquiry.contactPersonName,
    contactPersonPhone: enquiry.contactPersonPhone,
    contactPersonEmail: enquiry.contactPersonEmail,
    shipmentType: enquiry.shipmentType,
    serviceTypes: enquiry.serviceTypes,
    rfqReason: enquiry.rfqReason,
    freightDetail: enquiry.freightDetail ?? undefined,
    customsDetail: enquiry.customsDetail ?? undefined,
    transportDetail: enquiry.transportDetail ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.enquiry.update({ where: { id }, data: { status: "OPEN" } });
  return NextResponse.json({ enquiry: updated });
}
