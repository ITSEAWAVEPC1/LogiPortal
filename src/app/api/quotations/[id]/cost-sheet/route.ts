import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { costSheetReplaceSchema } from "@/lib/validation/quotation";
import { computeAmount, computeBuyRateInr, computeSellRate } from "@/lib/quotations/cost-sheet-math";
import type { Prisma } from "@/generated/prisma/client";

// Stage 14c — the cost-working sheet. GET/PUT are gated by the dedicated
// "quotationCosts" capability (NOT "quotations") so DOER and the customer
// portal never see buy rates; ACCOUNTS gets view-only.

const COST_SHEET_INCLUDE = {
  costLines: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
} satisfies Prisma.QuotationCostSheetInclude;

// The sheet can be edited while a quotation is still being worked up. Once
// APPROVED it's frozen (the sheet has no version dimension and touching it
// wouldn't change anything customer-facing until a re-/prepare, which would
// churn approval history — see stage-14c.md).
const EDITABLE_STATUSES = ["FLOATED", "COST_WORKING", "QUOTATION_PREPARED"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotationCosts", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const costSheet = await prisma.quotationCostSheet.findUnique({
    where: { quotationId: id },
    include: COST_SHEET_INCLUDE,
  });

  return NextResponse.json({
    costSheet: costSheet
      ? { id: costSheet.id, defaultMarginPct: costSheet.defaultMarginPct, notes: costSheet.notes, preparedAt: costSheet.preparedAt }
      : null,
    costLines: costSheet?.costLines ?? [],
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotationCosts", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(EDITABLE_STATUSES as readonly string[]).includes(quotation.status)) {
    return NextResponse.json(
      { error: `The cost sheet can't be edited once a quotation is ${quotation.status.replace(/_/g, " ")}` },
      { status: 409 },
    );
  }

  const body = await request.json();
  const parsed = costSheetReplaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { defaultMarginPct = null, notes = null, costLines } = parsed.data;

  const rows = costLines.map((line, index) => {
    const buyCurrency = (line.buyCurrency ?? "INR").toUpperCase();
    const buyRateInr = computeBuyRateInr({ buyCurrency, buyRate: line.buyRate, buyExchangeRate: line.buyExchangeRate });
    const sellRate = computeSellRate({
      buyRateInr,
      marginPct: line.marginPct,
      marginFlat: line.marginFlat,
      defaultMarginPct,
    });
    return {
      category: line.category,
      description: line.description,
      vendorName: line.vendorName ?? null,
      buyRate: line.buyRate ?? null,
      buyCurrency,
      buyExchangeRate: line.buyExchangeRate ?? null,
      buyRateInr,
      marginPct: line.marginPct ?? null,
      marginFlat: line.marginFlat ?? null,
      sellRate,
      quantity: line.quantity ?? null,
      amount: computeAmount({ quantity: line.quantity, sellRate }),
      sortOrder: line.sortOrder ?? index,
    };
  });

  const result = await prisma.$transaction(async (tx) => {
    const sheet = await tx.quotationCostSheet.upsert({
      where: { quotationId: id },
      create: { quotationId: id, defaultMarginPct, notes },
      update: { defaultMarginPct, notes },
    });
    await tx.quotationCostLine.deleteMany({ where: { costSheetId: sheet.id } });
    if (rows.length > 0) {
      await tx.quotationCostLine.createMany({ data: rows.map((r) => ({ ...r, costSheetId: sheet.id })) });
    }
    // First cost-sheet save moves a fresh quotation off FLOATED.
    if (quotation.status === "FLOATED") {
      await tx.quotation.update({ where: { id }, data: { status: "COST_WORKING" } });
    }
    return tx.quotationCostSheet.findUniqueOrThrow({ where: { quotationId: id }, include: COST_SHEET_INCLUDE });
  });

  return NextResponse.json({
    costSheet: { id: result.id, defaultMarginPct: result.defaultMarginPct, notes: result.notes, preparedAt: result.preparedAt },
    costLines: result.costLines,
  });
}
