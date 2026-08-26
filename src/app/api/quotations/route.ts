import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { createQuotationSchema } from "@/lib/validation/quotation";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_VALUES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "NEEDS_CORRECTION",
  "APPROVED",
  "SENT",
  "CUSTOMER_APPROVED",
  "CONVERTED",
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

// Bundles one or more READY_FOR_QUOTATION Enquiries (same Organization, same
// Branch) into a single Quotation. An Enquiry can only ever be attached to
// one Quotation (QuotationEnquiry.enquiryId is unique) — see stage-3.md.
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
  const { organizationId, enquiryIds: rawEnquiryIds } = parsed.data;
  const enquiryIds = Array.from(new Set(rawEnquiryIds));

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const enquiries = await prisma.enquiry.findMany({
    where: { id: { in: enquiryIds } },
    include: { quotationEnquiry: true },
  });
  if (enquiries.length !== enquiryIds.length) {
    return NextResponse.json({ error: "One or more enquiries were not found" }, { status: 404 });
  }

  const notReady = enquiries.find((e) => e.status !== "READY_FOR_QUOTATION");
  if (notReady) {
    return NextResponse.json(
      { error: `Enquiry ${notReady.id} is not Ready for Quotation (status: ${notReady.status})` },
      { status: 409 },
    );
  }

  const wrongOrg = enquiries.find((e) => e.organizationId !== organizationId);
  if (wrongOrg) {
    return NextResponse.json(
      { error: `Enquiry ${wrongOrg.id} belongs to a different customer than the one selected` },
      { status: 400 },
    );
  }

  const branchId = enquiries[0].branchId;
  const wrongBranch = enquiries.find((e) => e.branchId !== branchId);
  if (wrongBranch) {
    return NextResponse.json(
      { error: `Enquiry ${wrongBranch.id} belongs to a different branch — a Quotation can only bundle enquiries from one branch` },
      { status: 400 },
    );
  }

  const alreadyAttached = enquiries.find((e) => e.quotationEnquiry);
  if (alreadyAttached) {
    return NextResponse.json(
      { error: `Enquiry ${alreadyAttached.id} is already attached to another Quotation` },
      { status: 409 },
    );
  }

  const quotation = await prisma.$transaction(
    async (tx) => {
      const created = await tx.quotation.create({
        data: {
          organizationId,
          branchId,
          createdById: session.user.id,
          status: "DRAFT",
          currentVersionNumber: 1,
          enquiries: { create: enquiryIds.map((enquiryId) => ({ enquiryId })) },
          versions: {
            create: {
              versionNumber: 1,
              currency: organization.defaultCurrency ?? "INR",
              totalAmount: 0,
              createdById: session.user.id,
            },
          },
        },
      });
      return created;
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return NextResponse.json({ quotation }, { status: 201 });
}
