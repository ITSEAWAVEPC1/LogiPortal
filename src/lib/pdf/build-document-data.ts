import type { Prisma } from "@/generated/prisma/client";
import { formatJobRef } from "@/lib/validation/job";
import type {
  DeliveryOrderPdfData,
  DocContainerRow,
  DocPartyBlock,
  DocRouting,
  DocumentPdfBase,
  DocumentPdfData,
  FreightCertificatePdfData,
  HblPdfData,
  InvoiceLineRow,
  InvoicePdfData,
  MblPdfData,
} from "./types";

// The Job shape build-document-data needs. Routes/pages pass `include:
// DOCUMENT_JOB_INCLUDE` so the payload type lines up.
export const DOCUMENT_JOB_INCLUDE = {
  organization: { select: { name: true } },
  branch: { select: { name: true } },
  shipperDetail: true,
  consigneeDetail: true,
  notifyPartyDetail: true,
  containers: { orderBy: { sortOrder: "asc" } },
  workflowProgress: { select: { stepKey: true, data: true, status: true } },
} as const satisfies Prisma.JobInclude;

export type JobForDocument = Prisma.JobGetPayload<{ include: typeof DOCUMENT_JOB_INCLUDE }>;

export type GeneratableKind = "HBL" | "MBL" | "FREIGHT_CERTIFICATE" | "DELIVERY_ORDER" | "INVOICE";

const TITLE: Record<GeneratableKind, string> = {
  HBL: "House Bill of Lading",
  MBL: "Master Bill of Lading",
  FREIGHT_CERTIFICATE: "Freight Certificate",
  DELIVERY_ORDER: "Delivery Order",
  INVOICE: "Invoice",
};

function asRecord(v: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stepData(job: JobForDocument, stepKey: string): Record<string, unknown> {
  const row = job.workflowProgress.find((p) => p.stepKey === stepKey);
  return asRecord(row?.data ?? null);
}

function party(p: JobForDocument["shipperDetail"]): DocPartyBlock {
  return {
    name: p?.name ?? null,
    address: p?.address ?? null,
    contactPerson: p?.contactPerson ?? null,
    phone: p?.phone ?? null,
    email: p?.email ?? null,
  };
}

function routing(job: JobForDocument): DocRouting {
  return {
    placeOfReceipt: job.placeOfReceipt,
    portOfLoading: job.portOfLoading,
    portOfDischarge: job.portOfDischarge,
    placeOfDelivery: job.placeOfDelivery,
    vesselName: job.vesselName,
    voyageNumber: job.voyageNumber,
    shippingLineName: job.shippingLineName,
    cfsName: job.cfsName,
  };
}

function containers(job: JobForDocument): DocContainerRow[] {
  return job.containers.map((c) => ({
    containerNumber: c.containerNumber,
    sealNumber: c.sealNumber,
    containerType: c.containerType,
    count: c.count,
    grossWeight: c.grossWeight,
    netWeight: c.netWeight,
    packageCount: c.packageCount,
  }));
}

function base(job: JobForDocument, kind: GeneratableKind, ref: string): DocumentPdfBase {
  return {
    ref,
    jobRef: formatJobRef(job),
    title: TITLE[kind],
    generatedAt: new Date().toISOString(),
    organizationName: job.organization.name,
    branchName: job.branch.name,
    shipmentType: job.shipmentType,
    incoterm: job.incoterm,
    shipper: party(job.shipperDetail),
    consignee: party(job.consigneeDetail),
    notifyParty: party(job.notifyPartyDetail),
    routing: routing(job),
    containers: containers(job),
    totalGrossWeight: job.totalGrossWeight,
    totalNetWeight: job.totalNetWeight,
    totalPackages: job.totalPackages,
    volumeCbm: job.volumeCbm,
    commodity: job.commodity,
    hsCode: job.hsCode,
  };
}

function invoiceLines(job: JobForDocument): { lines: InvoiceLineRow[]; currency: string; total: number } {
  const currency = job.chargesCurrency ?? "INR";
  const raw = Array.isArray(job.charges) ? (job.charges as unknown[]) : [];
  const lines: InvoiceLineRow[] = raw.map((r) => {
    const o = asRecord(r as Prisma.JsonValue);
    return {
      category: str(o.category) ?? "OTHER",
      description: str(o.description) ?? "",
      amount: numOrNull(o.amount) ?? 0,
      currency: str(o.currency) ?? currency,
    };
  });
  const total = job.quotedTotal ?? lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, currency, total };
}

/**
 * Build the plain PDF data for a generatable document from a Job. Pure — no
 * IO. The same object is stored as the DocumentVersion.sourceSnapshot and
 * rendered by DocumentHtmlPreview on a generation failure.
 */
export function buildDocumentData(job: JobForDocument, kind: GeneratableKind, ref: string): DocumentPdfData {
  const b = base(job, kind, ref);

  if (kind === "HBL") {
    const d = stepData(job, "onboard_hbl_details");
    return { ...b, kind: "HBL", hblNumber: str(d.hblNumber), hblDate: str(d.hblDate) } satisfies HblPdfData;
  }

  if (kind === "MBL") {
    const mbl = stepData(job, "mbl_details");
    const rel = stepData(job, "export_bl_release");
    const type = stepData(job, "export_bl_type");
    return {
      ...b,
      kind: "MBL",
      mblNumber: str(mbl.mblNumber),
      mblDate: str(mbl.mblDate),
      blType: str(type.blType),
      blNumber: str(rel.blNumber),
      blDate: str(rel.blDate),
    } satisfies MblPdfData;
  }

  if (kind === "DELIVERY_ORDER") {
    const d = stepData(job, "delivery_order_release");
    return {
      ...b,
      kind: "DELIVERY_ORDER",
      deliveryOrderDate: str(d.date),
      freeDaysAtPod: job.freeDaysAtPod,
    } satisfies DeliveryOrderPdfData;
  }

  if (kind === "FREIGHT_CERTIFICATE") {
    const d = stepData(job, "freight_certificate_prep");
    return {
      ...b,
      kind: "FREIGHT_CERTIFICATE",
      certificateDate: str(d.certificateDate),
      fcShipperName: str(d.shipperName) ?? job.shipperDetail?.name ?? null,
      fcConsigneeName: str(d.consigneeName) ?? job.consigneeDetail?.name ?? null,
      fcPortOfLoading: str(d.portOfLoading) ?? job.portOfLoading ?? null,
      fcPortOfDischarge: str(d.portOfDischarge) ?? job.portOfDischarge ?? null,
      hblNumberDate: str(d.hblNumberDate),
      mblNumberDate: str(d.mblNumberDate),
      oceanFreightUsd: numOrNull(d.oceanFreightUsd),
      exWorksUsd: numOrNull(d.exWorksUsd),
    } satisfies FreightCertificatePdfData;
  }

  // INVOICE
  const { lines, currency, total } = invoiceLines(job);
  return {
    ...b,
    kind: "INVOICE",
    invoiceCurrency: currency,
    lineItems: lines,
    total,
  } satisfies InvoicePdfData;
}
