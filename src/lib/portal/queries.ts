import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { buildDocumentListWhere } from "@/lib/permissions/document-access";
import { DOCUMENT_CARD_SELECT, serializeDocument } from "@/lib/documents/document-service";
import { formatJobRef } from "@/lib/validation/job";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { assertOwnOrg, portalOrgWhere, type PortalContext } from "./guard";

// ---------------------------------------------------------------------------
// Stage 9 — every read the customer portal performs, organization-scoped and
// shaped for the (portal) pages. Server-only (imports prisma). The pages call
// these directly — there is no shared internal API route in the path.
// ---------------------------------------------------------------------------

export const PORTAL_PAGE_SIZE = 20;

// --- Jobs -----------------------------------------------------------------

const JOB_LIST_SELECT = {
  id: true,
  sequenceNumber: true,
  referenceNo: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  shipmentType: true,
  incoterm: true,
  portOfLoading: true,
  portOfDischarge: true,
  vesselName: true,
  voyageNumber: true,
} satisfies Prisma.JobSelect;

type JobListRaw = Prisma.JobGetPayload<{ select: typeof JOB_LIST_SELECT }>;

function toJobListRow(j: JobListRaw) {
  return {
    id: j.id,
    ref: formatJobRef(j),
    status: j.status,
    shipmentType: j.shipmentType,
    incoterm: j.incoterm,
    route: [j.portOfLoading, j.portOfDischarge].filter(Boolean).join(" → ") || "—",
    vessel: [j.vesselName, j.voyageNumber].filter(Boolean).join(" / ") || "—",
    updatedAt: j.updatedAt.toISOString(),
  };
}

export type PortalJobListRow = ReturnType<typeof toJobListRow>;

const JOB_STATUS_VALUES = [
  "DRAFT",
  "PENDING_REVIEW",
  "NEEDS_CORRECTION",
  "WORKFLOW_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export async function getPortalJobs(
  orgId: string | null,
  opts: { status?: string; q?: string; page?: number },
) {
  const page = Math.max(1, opts.page ?? 1);
  const status = JOB_STATUS_VALUES.find((s) => s === opts.status);
  const q = opts.q?.trim();

  const where: Prisma.JobWhereInput = {
    ...portalOrgWhere(orgId),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { referenceNo: { contains: q, mode: "insensitive" } },
            { vesselName: { contains: q, mode: "insensitive" } },
            { portOfLoading: { contains: q, mode: "insensitive" } },
            { portOfDischarge: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PORTAL_PAGE_SIZE,
      take: PORTAL_PAGE_SIZE,
      select: JOB_LIST_SELECT,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs: rows.map(toJobListRow), total, page, pageSize: PORTAL_PAGE_SIZE, status: status ?? "", q: q ?? "" };
}

const JOB_DETAIL_INCLUDE = {
  organization: { select: { name: true, city: true, state: true } },
  shipperDetail: true,
  consigneeDetail: true,
  notifyPartyDetail: true,
  containers: { orderBy: { sortOrder: "asc" } },
  workflowProgress: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.JobInclude;

type JobDetailRaw = Prisma.JobGetPayload<{ include: typeof JOB_DETAIL_INCLUDE }>;

function mapStepStatus(s: string): "completed" | "active" | "pending" {
  if (s === "COMPLETED" || s === "SKIPPED") return "completed";
  if (s === "IN_PROGRESS" || s === "PENDING_APPROVAL") return "active";
  return "pending";
}

function invoiceTotal(job: Pick<JobDetailRaw, "quotedTotal" | "charges">): number {
  if (typeof job.quotedTotal === "number") return job.quotedTotal;
  const rows = Array.isArray(job.charges) ? (job.charges as Array<{ amount?: unknown }>) : [];
  return rows.reduce((s, r) => s + (typeof r?.amount === "number" ? r.amount : 0), 0);
}

/**
 * Plan §4.3 "Duty payment — View, if their liability" + §5.7. The portal never
 * exposes the raw dutyPayment field group. It shows a status label derived
 * from the Incoterm, and the actual amount only when the Job marks the
 * customer's own side (not the consignee) as the liable party.
 *
 * ASSUMPTION (source docs underspecify this — flagged in stage-9.md): the
 * free-text `dutyPaymentLiability` names the customer's own side when it reads
 * like "own" / "self" / "shipper" / "customer" and does not say "consignee".
 */
function computeDutyView(
  incoterm: string | null,
  liability: string | null,
  amount: number | null,
): { label: string | null; amount: number | null } {
  const key = (incoterm ?? "").trim().toUpperCase();
  let label: string | null = null;
  if (key === "DDP") label = "Duty included in landed cost";
  else if (key === "DDU") label = "Duty payable by consignee";

  const liableToCustomer =
    !!liability &&
    /(^|[^a-z])(own|self|customer|shipper)([^a-z]|$)/i.test(liability) &&
    !/consignee/i.test(liability);

  return { label, amount: liableToCustomer ? amount : null };
}

function party(p: JobDetailRaw["shipperDetail"]) {
  if (!p) return null;
  return {
    name: p.name,
    address: p.address,
    contactPerson: p.contactPerson,
    phone: p.phone,
    email: p.email,
  };
}

function shapePortalJob(job: JobDetailRaw) {
  const duty = computeDutyView(job.incoterm, job.dutyPaymentLiability, job.dutyAmount);
  return {
    id: job.id,
    ref: formatJobRef(job),
    status: job.status,
    shipmentType: job.shipmentType,
    incoterm: job.incoterm,
    createdAt: job.createdAt.toISOString(),
    organizationName: job.organization.name,
    routing: {
      placeOfReceipt: job.placeOfReceipt,
      portOfLoading: job.portOfLoading,
      portOfDischarge: job.portOfDischarge,
      placeOfDelivery: job.placeOfDelivery,
      vesselName: job.vesselName,
      voyageNumber: job.voyageNumber,
      shippingLineName: job.shippingLineName,
      freeDaysAtPod: job.freeDaysAtPod,
    },
    cargo: {
      commodity: job.commodity,
      hsCode: job.hsCode,
      totalGrossWeight: job.totalGrossWeight,
      totalNetWeight: job.totalNetWeight,
      totalPackages: job.totalPackages,
      volumeCbm: job.volumeCbm,
    },
    parties: {
      shipper: party(job.shipperDetail),
      consignee: party(job.consigneeDetail),
      notifyParty: party(job.notifyPartyDetail),
    },
    containers: job.containers.map((c) => ({
      id: c.id,
      containerType: c.containerType,
      count: c.count,
      containerNumber: c.containerNumber,
      sealNumber: c.sealNumber,
      grossWeight: c.grossWeight,
      packageCount: c.packageCount,
    })),
    steps: job.workflowProgress.map((p) => ({
      id: p.id,
      label: p.label,
      status: mapStepStatus(p.status),
      rawStatus: p.status,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    })),
    invoice: {
      currency: job.chargesCurrency,
      total: invoiceTotal(job),
    },
    duty,
  };
}

export type PortalJob = ReturnType<typeof shapePortalJob>;

export async function getPortalJob(id: string, ctx: PortalContext, path: string): Promise<PortalJob> {
  const job = await prisma.job.findUnique({ where: { id }, include: JOB_DETAIL_INCLUDE });
  await assertOwnOrg(job?.organizationId ?? null, ctx, { path, resourceType: "job", resourceId: id });
  // assertOwnOrg() throws notFound() unless the job exists AND belongs to ctx.orgId.
  return shapePortalJob(job as JobDetailRaw);
}

// --- Quotations ---------------------------------------------------------

// Note: the Stage 14c cost sheet (QuotationCostSheet / QuotationCostLine) holds
// vendor buy rates + margin and is DELIBERATELY never selected here — the
// customer portal only ever sees the sell-side line items.

const QUOTATION_LIST_SELECT = {
  id: true,
  sequenceNumber: true,
  referenceNo: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  currentVersionNumber: true,
  sentAt: true,
  versions: {
    orderBy: { versionNumber: "desc" },
    take: 1,
    select: { versionNumber: true, totalAmount: true, currency: true },
  },
  _count: { select: { enquiries: true } },
} satisfies Prisma.QuotationSelect;

type QuotationListRaw = Prisma.QuotationGetPayload<{ select: typeof QUOTATION_LIST_SELECT }>;

function toQuotationListRow(qt: QuotationListRaw) {
  const v = qt.versions[0];
  return {
    id: qt.id,
    ref: formatQuotationRef(qt),
    status: qt.status,
    shipments: qt._count.enquiries,
    versionNumber: v?.versionNumber ?? qt.currentVersionNumber,
    total: v?.totalAmount ?? 0,
    currency: v?.currency ?? "INR",
    updatedAt: qt.updatedAt.toISOString(),
  };
}

export type PortalQuotationListRow = ReturnType<typeof toQuotationListRow>;

const QUOTATION_STATUS_VALUES = [
  // Stage 14b pipeline
  "FLOATED",
  "COST_WORKING",
  "QUOTATION_PREPARED",
  "APPROVED",
  "CONVERTED",
  // legacy (pre-14b)
  "DRAFT",
  "PENDING_APPROVAL",
  "NEEDS_CORRECTION",
  "SENT",
  "CUSTOMER_APPROVED",
] as const;

export async function getPortalQuotations(
  orgId: string | null,
  opts: { status?: string; q?: string; page?: number },
) {
  const page = Math.max(1, opts.page ?? 1);
  const status = QUOTATION_STATUS_VALUES.find((s) => s === opts.status);
  const q = opts.q?.trim();

  const where: Prisma.QuotationWhereInput = {
    ...portalOrgWhere(orgId),
    ...(status ? { status } : {}),
    ...(q ? { referenceNo: { contains: q, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PORTAL_PAGE_SIZE,
      take: PORTAL_PAGE_SIZE,
      select: QUOTATION_LIST_SELECT,
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    quotations: rows.map(toQuotationListRow),
    total,
    page,
    pageSize: PORTAL_PAGE_SIZE,
    status: status ?? "",
    q: q ?? "",
  };
}

export async function getPortalQuotation(id: string, ctx: PortalContext, path: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, currency: true, totalAmount: true, approvedAt: true },
      },
      enquiries: {
        select: { enquiry: { select: { id: true, referenceNo: true, sequenceNumber: true, createdAt: true, shipmentType: true, serviceTypes: true } } },
      },
    },
  });
  await assertOwnOrg(quotation?.organizationId ?? null, ctx, { path, resourceType: "quotation", resourceId: id });

  const qt = quotation!;
  const current = qt.versions.find((v) => v.versionNumber === qt.currentVersionNumber) ?? qt.versions[0] ?? null;
  const lineItems = current
    ? await prisma.quotationLineItem.findMany({
        where: { quotationVersionId: current.id },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        select: { id: true, category: true, description: true, rate: true, quantity: true, amount: true, currency: true },
      })
    : [];

  return {
    id: qt.id,
    ref: formatQuotationRef(qt),
    status: qt.status,
    createdAt: qt.createdAt.toISOString(),
    sentAt: qt.sentAt ? qt.sentAt.toISOString() : null,
    customerApproved: qt.customerApproved,
    versionNumber: current?.versionNumber ?? qt.currentVersionNumber,
    currency: current?.currency ?? "INR",
    total: current?.totalAmount ?? 0,
    approvedAt: current?.approvedAt ? current.approvedAt.toISOString() : null,
    enquiries: qt.enquiries.map((qe) => ({
      id: qe.enquiry.id,
      ref: qe.enquiry.referenceNo ?? `ENQ-${qe.enquiry.sequenceNumber}`,
      shipmentType: qe.enquiry.shipmentType,
      serviceTypes: qe.enquiry.serviceTypes,
    })),
    lineItems: lineItems.map((li) => ({ ...li })),
  };
}

export type PortalQuotation = Awaited<ReturnType<typeof getPortalQuotation>>;

// --- Documents --------------------------------------------------------

export async function getPortalDocuments(orgId: string | null, jobId?: string) {
  const rows = await prisma.document.findMany({
    where: buildDocumentListWhere("CUSTOMER", orgId, jobId ? { jobId } : undefined),
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_CARD_SELECT,
    take: 300,
  });
  return rows.map(serializeDocument);
}

// --- Dashboard -------------------------------------------------------

export async function getPortalDashboard(orgId: string | null) {
  if (!orgId) {
    return { jobsTotal: 0, jobsOngoing: 0, quotationsAwaiting: 0, documentsShared: 0, recentJobs: [] as PortalJobListRow[] };
  }
  const [jobsTotal, jobsOngoing, quotationsAwaiting, documentsShared, recent] = await Promise.all([
    prisma.job.count({ where: { organizationId: orgId } }),
    prisma.job.count({ where: { organizationId: orgId, status: "WORKFLOW_IN_PROGRESS" } }),
    // Stage 14b — the pipeline notifies the customer at QUOTATION_PREPARED/
    // APPROVED (no SENT/CUSTOMER_APPROVED step); keep the legacy values too.
    prisma.quotation.count({
      where: {
        organizationId: orgId,
        status: { in: ["QUOTATION_PREPARED", "APPROVED", "SENT", "CUSTOMER_APPROVED"] },
      },
    }),
    prisma.document.count({ where: buildDocumentListWhere("CUSTOMER", orgId) }),
    prisma.job.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: JOB_LIST_SELECT,
    }),
  ]);
  return {
    jobsTotal,
    jobsOngoing,
    quotationsAwaiting,
    documentsShared,
    recentJobs: recent.map(toJobListRow),
  };
}

// --- Profile --------------------------------------------------------

export async function getPortalProfile(orgId: string | null) {
  if (!orgId) return null;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      alias: true,
      city: true,
      state: true,
      contactPersonName: true,
      contactPersonPhone: true,
      contactPersonEmail: true,
      defaultCurrency: true,
      kycDetail: { select: { gstNumber: true, panNumber: true, tanNumber: true } },
    },
  });
  return org;
}
