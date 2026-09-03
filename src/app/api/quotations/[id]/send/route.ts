import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { fireAfterResponse } from "@/lib/notifications/fire";
import { quotationSent } from "@/lib/notifications/events";

// The literal Section 5.3 approval gate: a quotation cannot be marked Sent
// without Branch Manager approval — enforced here, not just in the UI.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status !== "APPROVED") {
    return NextResponse.json(
      { error: `A quotation must be Approved before it can be marked Sent (current status: ${quotation.status})` },
      { status: 409 },
    );
  }

  const updated = await prisma.quotation.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });

  fireAfterResponse(
    await quotationSent({
      quotationId: id,
      quotationRef: formatQuotationRef(quotation),
      organizationId: quotation.organizationId,
      createdById: quotation.createdById,
      actorId: session.user.id,
    }),
  );

  return NextResponse.json({ quotation: updated });
}
