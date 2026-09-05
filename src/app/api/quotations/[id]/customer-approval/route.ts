import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { customerApprovalSchema, formatQuotationRef } from "@/lib/validation/quotation";
import { fireAfterResponse } from "@/lib/notifications/fire";
import { quotationCustomerApproved } from "@/lib/notifications/events";

// DEAD as of Stage 14b — the new pipeline has no recorded customer sign-off
// (APPROVED goes straight to Convert). Left in place, still callable, for
// legacy pre-14b quotations. SENT -> CUSTOMER_APPROVED.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = customerApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status !== "SENT") {
    return NextResponse.json(
      { error: `Customer approval can only be recorded once a quotation has been Sent (current status: ${quotation.status})` },
      { status: 409 },
    );
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: "CUSTOMER_APPROVED",
      customerApproved: true,
      customerApprovedAt: new Date(),
      customerApprovedById: session.user.id,
      customerApprovedNote: parsed.data.note ?? null,
    },
  });

  fireAfterResponse(
    quotationCustomerApproved({
      quotationId: id,
      quotationRef: formatQuotationRef(quotation),
      createdById: quotation.createdById,
      actorId: session.user.id,
    }),
  );

  return NextResponse.json({ quotation: updated });
}
