import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getJobFieldAccess, redactJobForRole } from "@/lib/permissions/job-fields";
import { jobAutosaveSchema } from "@/lib/validation/job";
import type { Prisma } from "@/generated/prisma/client";

export const JOB_DETAIL_INCLUDE = {
  organization: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  quotationEnquiry: { select: { id: true, quotationId: true } },
  shipperDetail: true,
  consigneeDetail: true,
  notifyPartyDetail: true,
  containers: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.JobInclude;

const EDITABLE_STATUSES = ["DRAFT", "NEEDS_CORRECTION"] as const;

// Stage 10b — the workflowStatus field group's only autosave keys. A PATCH
// carrying *only* these is a delivery-date correction and is allowed on an
// in-progress / completed job too (not just DRAFT / NEEDS_CORRECTION).
const DELIVERY_DATE_KEYS = ["expectedDeliveryDate", "actualDeliveryDate"] as const;

function toDateOrNull(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, include: JOB_DETAIL_INCLUDE });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fieldAccess = await getJobFieldAccess(session.user.role);
  return NextResponse.json({ job: redactJobForRole(job, fieldAccess), fieldAccess });
}

// Lenient autosave/edit. Non-Admins can only edit DRAFT/NEEDS_CORRECTION jobs;
// each Section 4.3 field group is applied only if the role has EDIT on it, and
// a group it can't touch is left completely untouched (never nulled).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = jobAutosaveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  const sentKeys = Object.keys(d);
  const deliveryDatesOnly =
    sentKeys.length > 0 && sentKeys.every((k) => (DELIVERY_DATE_KEYS as readonly string[]).includes(k));

  if (
    session.user.role !== "ADMIN" &&
    !deliveryDatesOnly &&
    !EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])
  ) {
    return NextResponse.json({ error: `Cannot edit a job with status ${existing.status}` }, { status: 409 });
  }

  const access = await getJobFieldAccess(session.user.role);

  const jobData: Prisma.JobUpdateInput = {};
  if (access.portVesselContainer === "EDIT") {
    Object.assign(jobData, {
      incoterm: d.incoterm,
      exportStuffingType: d.exportStuffingType,
      serviceTypes: d.serviceTypes,
      agentDetails: d.agentDetails,
      placeOfReceipt: d.placeOfReceipt,
      portOfLoading: d.portOfLoading,
      portOfDischarge: d.portOfDischarge,
      placeOfDelivery: d.placeOfDelivery,
      shippingLineName: d.shippingLineName,
      cfsName: d.cfsName,
      vesselName: d.vesselName,
      voyageNumber: d.voyageNumber,
      freeDaysAtPod: d.freeDaysAtPod,
      totalGrossWeight: d.totalGrossWeight,
      totalNetWeight: d.totalNetWeight,
      totalPackages: d.totalPackages,
      volumeCbm: d.volumeCbm,
      commodity: d.commodity,
      hsCode: d.hsCode,
    });
  }
  if (access.charges === "EDIT") {
    Object.assign(jobData, {
      charges: d.charges === undefined ? undefined : (d.charges as Prisma.InputJsonValue | null) ?? undefined,
      chargesCurrency: d.chargesCurrency,
      quotedTotal: d.quotedTotal,
    });
  }
  if (access.dutyPayment === "EDIT") {
    Object.assign(jobData, {
      dutyPaymentLiability: d.dutyPaymentLiability,
      dutyAmount: d.dutyAmount,
      dutyPaidBy: d.dutyPaidBy,
    });
  }
  if (access.internalNotes === "EDIT") {
    jobData.internalNotes = d.internalNotes;
  }
  if (access.workflowStatus === "EDIT") {
    const expected = toDateOrNull(d.expectedDeliveryDate);
    const actual = toDateOrNull(d.actualDeliveryDate);
    if (expected !== undefined) jobData.expectedDeliveryDate = expected;
    if (actual !== undefined) jobData.actualDeliveryDate = actual;
  }

  const job = await prisma.$transaction(
    async (tx) => {
      const updated = await tx.job.update({ where: { id }, data: jobData });

      if (access.shipperConsigneeNotify === "EDIT") {
        if (d.shipperDetail) {
          await tx.shipperDetail.upsert({
            where: { jobId: id },
            create: { jobId: id, ...d.shipperDetail },
            update: { ...d.shipperDetail },
          });
        }
        if (d.consigneeDetail) {
          await tx.consigneeDetail.upsert({
            where: { jobId: id },
            create: { jobId: id, ...d.consigneeDetail },
            update: { ...d.consigneeDetail },
          });
        }
        if (d.notifyPartyDetail) {
          await tx.notifyPartyDetail.upsert({
            where: { jobId: id },
            create: { jobId: id, ...d.notifyPartyDetail },
            update: { ...d.notifyPartyDetail },
          });
        }
      }

      // Replace-children wholesale (same convention as Customer Master v2's
      // branches / Quotation line items) — safe: nothing outside a Job's own
      // subtree references container ids.
      if (access.portVesselContainer === "EDIT" && d.containers !== undefined) {
        await tx.containerDetail.deleteMany({ where: { jobId: id } });
        if (d.containers.length) {
          await tx.containerDetail.createMany({
            data: d.containers.map((c, i) => ({
              jobId: id,
              containerNumber: c.containerNumber ?? null,
              sealNumber: c.sealNumber ?? null,
              containerType: c.containerType ?? null,
              count: c.count ?? 1,
              grossWeight: c.grossWeight ?? null,
              tareWeight: c.tareWeight ?? null,
              netWeight: c.netWeight ?? null,
              packageCount: c.packageCount ?? null,
              sortOrder: c.sortOrder ?? i,
            })),
          });
        }
      }

      return updated;
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return NextResponse.json({ job });
}
