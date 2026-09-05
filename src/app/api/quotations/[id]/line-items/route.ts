import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { lineItemsReplaceSchema } from "@/lib/validation/quotation";

// Stage 14b pipeline first, then the legacy pre-14b statuses for old rows.
const IN_PLACE_EDITABLE_STATUSES = ["FLOATED", "COST_WORKING", "QUOTATION_PREPARED", "DRAFT", "NEEDS_CORRECTION"] as const;
const CLONE_ON_EDIT_STATUSES = ["APPROVED"] as const;

// Replace-all for the current version's line items. Before approval this
// mutates the current version in place — same "replace children wholesale"
// convention as Customer Master v2's branches/bill-types. Once a version has
// been APPROVED, an edit instead clones the line items into versionNumber + 1
// and resets the Quotation to QUOTATION_PREPARED for re-approval, so the
// approved version's history (and its approvedBy/approvedAt) is never
// overwritten. See stage-3.md / stage-14b.md.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quotation.status === "CONVERTED") {
    return NextResponse.json({ error: "This quotation has been converted and is locked" }, { status: 409 });
  }
  if (quotation.status === "PENDING_APPROVAL") {
    return NextResponse.json(
      { error: "Cannot edit a quotation while it is pending Branch Manager review" },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = lineItemsReplaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { lineItems } = parsed.data;
  // Stage 12d — currency is per-line now; the version's total is always a
  // single INR figure (each line converts via rateInr), so the version's
  // own currency column is pinned to "INR" rather than client-supplied.
  const currency = "INR";
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const currentVersion = await prisma.quotationVersion.findUnique({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
  });
  if (!currentVersion) return NextResponse.json({ error: "Current version not found" }, { status: 404 });

  const result = await prisma.$transaction(
    async (tx) => {
      if ((IN_PLACE_EDITABLE_STATUSES as readonly string[]).includes(quotation.status)) {
        await tx.quotationLineItem.deleteMany({ where: { quotationVersionId: currentVersion.id } });
        await tx.quotationVersion.update({
          where: { id: currentVersion.id },
          data: {
            currency,
            totalAmount,
            lineItems: { create: lineItems.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index })) },
          },
        });
        const updatedQuotation = await tx.quotation.findUniqueOrThrow({ where: { id } });
        return { quotation: updatedQuotation, versionNumber: currentVersion.versionNumber };
      }

      if ((CLONE_ON_EDIT_STATUSES as readonly string[]).includes(quotation.status)) {
        const nextVersionNumber = quotation.currentVersionNumber + 1;
        await tx.quotationVersion.create({
          data: {
            quotationId: id,
            versionNumber: nextVersionNumber,
            currency,
            totalAmount,
            createdById: session.user.id,
            lineItems: { create: lineItems.map((item, index) => ({ ...item, sortOrder: item.sortOrder ?? index })) },
          },
        });
        const updatedQuotation = await tx.quotation.update({
          where: { id },
          data: {
            currentVersionNumber: nextVersionNumber,
            status: "QUOTATION_PREPARED",
            reviewedById: null,
            reviewedAt: null,
            reviewNote: null,
            sentAt: null,
            customerApproved: false,
            customerApprovedAt: null,
            customerApprovedNote: null,
            customerApprovedById: null,
          },
        });
        return { quotation: updatedQuotation, versionNumber: nextVersionNumber };
      }

      throw new Error(`Unexpected quotation status: ${quotation.status}`);
    },
    { timeout: 20000, maxWait: 10000 },
  );

  const newVersion = await prisma.quotationVersion.findUniqueOrThrow({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: result.versionNumber } },
  });
  const newLineItems = await prisma.quotationLineItem.findMany({
    where: { quotationVersionId: newVersion.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ quotation: result.quotation, currentVersion: newVersion, lineItems: newLineItems });
}
