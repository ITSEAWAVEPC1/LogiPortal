import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { createQuotationSchema } from "@/lib/validation/quotation";
import { allocateRfqReference, inheritRfqReference } from "@/lib/reference/generate-reference";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_VALUES = [
  // Stage 14b pipeline
  "FLOATED",
  "COST_WORKING",
  "QUOTATION_PREPARED",
  "APPROVED",
  "CONVERTED",
  // legacy (pre-14b) — kept so their tabs/filters still resolve
  "DRAFT",
  "PENDING_APPROVAL",
  "NEEDS_CORRECTION",
  "SENT",
  "CUSTOMER_APPROVED",
] as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = STATUS_VALUES.find((s) => s === statusParam);
  const branchId = searchParams.get("branchId") ?? undefined;
  const q = searchParams.get("q")?.trim();

  const where: Prisma.QuotationWhereInput = {
    status,
    branchId: branchId || undefined,
    ...(q ? { organization: { name: { contains: q, mode: "insensitive" } } } : {}),
  };

  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { enquiries: true } },
      // Versions are only ever created with an increasing versionNumber, so
      // the latest one (desc, take 1) is always the current version.
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { totalAmount: true, currency: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quotations });
}

// Bundles a single READY_FOR_QUOTATION Enquiry into a new Quotation. An
// Enquiry can only ever be attached to one Quotation
// (QuotationEnquiry.enquiryId is unique) — see stage-3.md. Stage 12d
// restricted creation to exactly one Enquiry per Quotation (single-select
// radio in the builder UI); QuotationEnquiry's join-table shape is
// unchanged, just never given more than one row per Quotation going forward.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { organizationId, enquiryId } = parsed.data;

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { quotationEnquiry: true },
  });
  if (!enquiry) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });

  if (enquiry.status !== "READY_FOR_QUOTATION") {
    return NextResponse.json(
      { error: `Enquiry ${enquiry.id} is not Ready for Quotation (status: ${enquiry.status})` },
      { status: 409 },
    );
  }
  if (enquiry.organizationId !== organizationId) {
    return NextResponse.json({ error: "Enquiry belongs to a different customer than the one selected" }, { status: 400 });
  }
  if (enquiry.quotationEnquiry) {
    return NextResponse.json({ error: "This enquiry is already attached to another Quotation" }, { status: 409 });
  }

  const quotation = await prisma.$transaction(
    async (tx) => {
      // Unified reference: reuse the enquiry's RFQ number verbatim. A
      // pre-backfill enquiry with no referenceNo yet falls back to a fresh
      // mint so the quotation is never left without a reference.
      const ref = inheritRfqReference(enquiry) ?? (await allocateRfqReference(tx));
      const created = await tx.quotation.create({
        data: {
          organizationId,
          branchId: enquiry.branchId,
          createdById: session.user.id,
          // Stage 14b — new quotations start FLOATED (enquiry attached, no
          // costing done yet), not DRAFT.
          status: "FLOATED",
          currentVersionNumber: 1,
          referenceNo: ref.referenceNo,
          refYear: ref.refYear,
          refSequence: ref.refSequence,
          enquiries: { create: [{ enquiryId }] },
          versions: {
            // Stage 12d — the version total is always a single INR figure
            // (each line item converts to INR on its own via rateInr), so
            // this is no longer the customer's/organization's currency.
            create: { versionNumber: 1, currency: "INR", totalAmount: 0, createdById: session.user.id },
          },
        },
      });
      return created;
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return NextResponse.json({ quotation }, { status: 201 });
}
