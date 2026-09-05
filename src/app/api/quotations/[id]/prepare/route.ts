import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

// Stage 14c — "Prepare Quotation": (re)generate the current version's
// customer-facing QuotationLineItem rows from the cost sheet's sell side.
// Replace-all and re-runnable. From COST_WORKING/QUOTATION_PREPARED it edits
// the current version in place; from APPROVED it clones a new version (same
// rule as the line-items PUT) and drops back to QUOTATION_PREPARED.
const PREPARABLE_STATUSES = ["COST_WORKING", "QUOTATION_PREPARED", "APPROVED"] as const;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotationCosts", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { costSheet: { include: { costLines: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] } } } },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(PREPARABLE_STATUSES as readonly string[]).includes(quotation.status)) {
    return NextResponse.json(
      { error: `Cannot prepare a quotation with status ${quotation.status.replace(/_/g, " ")}` },
      { status: 409 },
    );
  }

  const costLines = quotation.costSheet?.costLines ?? [];
  if (costLines.length === 0) {
    return NextResponse.json({ error: "Add at least one cost line before preparing the quotation" }, { status: 409 });
  }

  const rows = costLines.map((line, index) => ({
    category: line.category,
    description: line.description,
    rate: line.sellRate,
    quantity: line.quantity,
    amount: line.amount,
    currency: "INR",
    exchangeRate: null,
    rateInr: line.sellRate,
    remarks: null,
    sortOrder: index,
  }));
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  const result = await prisma.$transaction(
    async (tx) => {
      if (quotation.status === "APPROVED") {
        const nextVersionNumber = quotation.currentVersionNumber + 1;
        await tx.quotationVersion.create({
          data: {
            quotationId: id,
            versionNumber: nextVersionNumber,
            currency: "INR",
            totalAmount,
            createdById: session.user.id,
            lineItems: { create: rows },
          },
        });
        await tx.quotation.update({
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
      } else {
        const currentVersion = await tx.quotationVersion.findUniqueOrThrow({
          where: { quotationId_versionNumber: { quotationId: id, versionNumber: quotation.currentVersionNumber } },
        });
        await tx.quotationLineItem.deleteMany({ where: { quotationVersionId: currentVersion.id } });
        await tx.quotationVersion.update({
          where: { id: currentVersion.id },
          data: { currency: "INR", totalAmount, lineItems: { create: rows } },
        });
        await tx.quotation.update({ where: { id }, data: { status: "QUOTATION_PREPARED" } });
      }

      await tx.quotationCostSheet.update({ where: { quotationId: id }, data: { preparedAt: new Date() } });

      return tx.quotation.findUniqueOrThrow({ where: { id } });
    },
    { timeout: 20000, maxWait: 10000 },
  );

  const currentVersion = await prisma.quotationVersion.findUniqueOrThrow({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber: result.currentVersionNumber } },
  });
  const lineItems = await prisma.quotationLineItem.findMany({
    where: { quotationVersionId: currentVersion.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ quotation: result, currentVersion, lineItems });
}
