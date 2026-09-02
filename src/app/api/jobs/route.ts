import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { createJobDirectSchema, createJobFromQuotationSchema } from "@/lib/validation/job";
import { allocateRfqReference, inheritRfqReference } from "@/lib/reference/generate-reference";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_VALUES = [
  "DRAFT",
  "PENDING_REVIEW",
  "NEEDS_CORRECTION",
  "WORKFLOW_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
const SHIPMENT_TYPES = ["IMPORT", "EXPORT"] as const;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = STATUS_VALUES.find((s) => s === statusParam);
  const shipmentParam = searchParams.get("shipmentType");
  const shipmentType = SHIPMENT_TYPES.find((s) => s === shipmentParam);
  const branchId = searchParams.get("branchId") || undefined;
  const organizationId = searchParams.get("organizationId") || undefined;
  const q = searchParams.get("q")?.trim();

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const where: Prisma.JobWhereInput = {
    status,
    shipmentType,
    branchId,
    organizationId,
    ...(q
      ? {
          OR: [
            { organization: { name: { contains: q, mode: "insensitive" } } },
            { vesselName: { contains: q, mode: "insensitive" } },
            { portOfLoading: { contains: q, mode: "insensitive" } },
            { portOfDischarge: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, pageSize });
}

// Job snapshot shape written by POST /api/quotations/[id]/convert.
interface JobSnapshot {
  quotation: {
    id: string;
    ref: string;
    currency: string;
    totalAmount: number;
    lineItems: Array<Record<string, unknown>>;
  };
  enquiry: {
    branchId: string;
    organizationId: string;
    shipmentType: "IMPORT" | "EXPORT" | null;
    serviceTypes: string[];
    freightDetail: {
      incoterm: string | null;
      portOfLoading: string | null;
      portOfDischarge: string | null;
      containerType: string | null;
      containerCount: number | null;
      weight: number | null;
      fclWeight: number | null;
      packageCount: number | null;
    } | null;
    customsDetail: { hsCode: string | null; commodity: string | null } | null;
    transportDetail: { pickup: string | null; destination: string | null } | null;
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // --- Path A: inherit from a CONVERTED quotation's per-enquiry snapshot ---
  if (body && typeof body === "object" && "quotationEnquiryId" in body) {
    const parsed = createJobFromQuotationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const qe = await prisma.quotationEnquiry.findUnique({
      where: { id: parsed.data.quotationEnquiryId },
      include: {
        job: { select: { id: true } },
        quotation: { select: { status: true, referenceNo: true } },
        enquiry: { select: { referenceNo: true, refYear: true, refSequence: true } },
      },
    });
    if (!qe) return NextResponse.json({ error: "Quotation enquiry not found" }, { status: 404 });
    if (qe.job) {
      return NextResponse.json({ error: "A Job already exists for this quotation enquiry", jobId: qe.job.id }, { status: 409 });
    }
    if (qe.quotation.status !== "CONVERTED" || !qe.jobSnapshot) {
      return NextResponse.json({ error: "This quotation enquiry has not been converted to a Job yet" }, { status: 409 });
    }

    const snap = qe.jobSnapshot as unknown as JobSnapshot;
    const freight = snap.enquiry.freightDetail;
    const transport = snap.enquiry.transportDetail;
    const shipmentType = snap.enquiry.shipmentType;
    if (!shipmentType) {
      return NextResponse.json({ error: "Source enquiry has no shipment type; cannot build a Job" }, { status: 409 });
    }

    const containerRows =
      freight?.containerType || freight?.containerCount
        ? [
            {
              containerType: freight?.containerType ?? null,
              count: freight?.containerCount ?? 1,
              sortOrder: 0,
            },
          ]
        : [];

    // Unified reference: reuse the originating enquiry's RFQ number verbatim
    // (sourceReference points back to the parent quotation). A pre-backfill
    // enquiry with no referenceNo falls back to a fresh mint.
    const job = await prisma.$transaction(
      async (tx) => {
        const ref = inheritRfqReference(qe.enquiry) ?? (await allocateRfqReference(tx));
        return tx.job.create({
          data: {
            origin: "QUOTATION",
            status: "DRAFT",
            branchId: snap.enquiry.branchId,
            organizationId: snap.enquiry.organizationId,
            shipmentType,
            serviceTypes: snap.enquiry.serviceTypes as Prisma.JobCreateInput["serviceTypes"],
            incoterm: freight?.incoterm ?? null,
            portOfLoading: freight?.portOfLoading ?? null,
            portOfDischarge: freight?.portOfDischarge ?? null,
            placeOfReceipt: transport?.pickup ?? null,
            placeOfDelivery: transport?.destination ?? null,
            hsCode: snap.enquiry.customsDetail?.hsCode ?? null,
            commodity: snap.enquiry.customsDetail?.commodity ?? null,
            totalGrossWeight: freight?.fclWeight ?? freight?.weight ?? null,
            totalPackages: freight?.packageCount ?? null,
            charges: snap.quotation.lineItems as Prisma.InputJsonValue,
            chargesCurrency: snap.quotation.currency,
            quotedTotal: snap.quotation.totalAmount,
            createdById: session.user.id,
            quotationEnquiryId: parsed.data.quotationEnquiryId,
            referenceNo: ref.referenceNo,
            refYear: ref.refYear,
            refSequence: ref.refSequence,
            sourceReference: qe.quotation.referenceNo ?? null,
            containers: containerRows.length ? { create: containerRows } : undefined,
          },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );

    return NextResponse.json({ job }, { status: 201 });
  }

  // --- Path B: direct create, no quotation ---
  const parsed = createJobDirectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const [organization, branch] = await Promise.all([
    prisma.organization.findUnique({ where: { id: parsed.data.organizationId } }),
    prisma.branch.findUnique({ where: { id: parsed.data.branchId } }),
  ]);
  if (!organization) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  // Direct create has no parent enquiry — mint a fresh RFQ number.
  const job = await prisma.$transaction(
    async (tx) => {
      const ref = await allocateRfqReference(tx);
      return tx.job.create({
        data: {
          origin: "DIRECT",
          status: "DRAFT",
          branchId: parsed.data.branchId,
          organizationId: parsed.data.organizationId,
          shipmentType: parsed.data.shipmentType,
          serviceTypes: parsed.data.serviceTypes as Prisma.JobCreateInput["serviceTypes"],
          createdById: session.user.id,
          referenceNo: ref.referenceNo,
          refYear: ref.refYear,
          refSequence: ref.refSequence,
        },
      });
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return NextResponse.json({ job }, { status: 201 });
}
