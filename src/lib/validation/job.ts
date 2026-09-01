import { z } from "zod";
import type { TargetField } from "@/lib/import/column-matcher";
import { SERVICE_TYPE_OPTIONS, SHIPMENT_TYPE_OPTIONS } from "./enquiry";

// Re-export so Job screens can import shipment/service option lists from one place.
export { SERVICE_TYPE_OPTIONS, SHIPMENT_TYPE_OPTIONS };

// Hardcoded UI lists — no Port/CFS/ShippingLine/ContainerType master tables
// this stage (same precedent as Customer Master v2's currency handling).
export const INCOTERM_OPTIONS = ["EXW", "FOB", "CIF", "DDP", "DDU", "FCA", "CPT", "CIP", "DAP", "DPU"].map((v) => ({
  value: v,
  label: v,
}));

export const COMMON_CONTAINER_TYPES = ["20GP", "40GP", "40HC", "20RF", "40RF", "20OT", "40OT", "20FR", "40FR", "20TK"];

export const JOB_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "NEEDS_CORRECTION", label: "Needs Correction" },
  { value: "WORKFLOW_IN_PROGRESS", label: "Workflow in Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export type JobStatusValue = (typeof JOB_STATUS_OPTIONS)[number]["value"];

export function formatJobRef(createdAt: string | Date, sequenceNumber: number): string {
  const year = new Date(createdAt).getFullYear();
  return `JOB-${year}-${String(sequenceNumber).padStart(4, "0")}`;
}

const num = z.number().nullable().optional();
const int = z.number().int().nullable().optional();
const str = z.string().trim().nullable().optional();

const shipmentTypeEnum = z.enum(["IMPORT", "EXPORT"]);
const serviceTypeEnum = z.enum([
  "FREIGHT_FORWARDING",
  "CUSTOMS_CLEARANCE",
  "TRANSPORTATION",
  "WAREHOUSING",
  "EXIM_CONSULTANCY",
]);

// ---------------------------------------------------------------------------
// Create — two entry points (plan decision #1)
// ---------------------------------------------------------------------------

export const createJobFromQuotationSchema = z.object({
  quotationEnquiryId: z.string().min(1),
});

export const createJobDirectSchema = z.object({
  branchId: z.string().min(1, "Branch is required"),
  organizationId: z.string().min(1, "Customer is required"),
  shipmentType: shipmentTypeEnum,
  serviceTypes: z.array(serviceTypeEnum).optional().default([]),
});

// ---------------------------------------------------------------------------
// Autosave — lenient, every field optional. This is what the detail form
// PATCHes as the Doer works; the route then applies each field group only if
// the caller's role has EDIT on it (field-permissions.ts, resource "job").
// ---------------------------------------------------------------------------

const partyDetailSchema = z.object({
  name: str,
  address: str,
  contactPerson: str,
  phone: str,
  email: str,
});
export type PartyDetailInput = z.infer<typeof partyDetailSchema>;

export const containerRowSchema = z.object({
  containerNumber: str,
  sealNumber: str,
  containerType: str,
  count: int,
  grossWeight: num,
  tareWeight: num,
  netWeight: num,
  packageCount: int,
  sortOrder: z.number().int().optional(),
});
export type ContainerRowInput = z.infer<typeof containerRowSchema>;

// Lenient — `charges` is stored as an opaque JSON snapshot on the Job (copied
// from the quotation, adjustable by Accounts). This is input hygiene, not a
// DB-shape contract.
const chargeLineSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  rate: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  currency: z.string().optional(),
  sortOrder: z.number().int().optional(),
});
export type JobChargeLineInput = z.infer<typeof chargeLineSchema>;

export const jobAutosaveSchema = z.object({
  // portVesselContainer field group (routing / vessel / measurements / cargo).
  incoterm: str,
  serviceTypes: z.array(serviceTypeEnum).optional(),
  agentDetails: str,
  placeOfReceipt: str,
  portOfLoading: str,
  portOfDischarge: str,
  placeOfDelivery: str,
  shippingLineName: str,
  cfsName: str,
  vesselName: str,
  voyageNumber: str,
  freeDaysAtPod: int,
  totalGrossWeight: num,
  totalNetWeight: num,
  totalPackages: int,
  volumeCbm: num,
  commodity: str,
  hsCode: str,
  containers: z.array(containerRowSchema).optional(),
  // shipperConsigneeNotify field group.
  shipperDetail: partyDetailSchema.optional(),
  consigneeDetail: partyDetailSchema.optional(),
  notifyPartyDetail: partyDetailSchema.optional(),
  // charges field group.
  charges: z.array(chargeLineSchema).nullable().optional(),
  chargesCurrency: str,
  quotedTotal: num,
  // dutyPayment field group.
  dutyPaymentLiability: str,
  dutyAmount: num,
  dutyPaidBy: str,
  // internalNotes field group.
  internalNotes: str,
});

export type JobAutosaveInput = z.infer<typeof jobAutosaveSchema>;

// Maps each Section 4.3 field group (field-permissions.ts JOB_FIELD_GROUPS) to
// the autosave keys it governs. The PATCH route iterates this and applies a
// group's keys only when the role has EDIT on that group; a group it can't
// touch is left completely untouched (never nulled) — Customer Master v2
// decision #2. `workflowStatus` / `documents` have no Stage 4 autosave keys
// (status transitions go through submit/review; documents are Stage 7).
export const JOB_FIELD_GROUP_KEYS = {
  shipperConsigneeNotify: ["shipperDetail", "consigneeDetail", "notifyPartyDetail"],
  portVesselContainer: [
    "incoterm",
    "serviceTypes",
    "agentDetails",
    "placeOfReceipt",
    "portOfLoading",
    "portOfDischarge",
    "placeOfDelivery",
    "shippingLineName",
    "cfsName",
    "vesselName",
    "voyageNumber",
    "freeDaysAtPod",
    "totalGrossWeight",
    "totalNetWeight",
    "totalPackages",
    "volumeCbm",
    "commodity",
    "hsCode",
    "containers",
  ],
  workflowStatus: [],
  charges: ["charges", "chargesCurrency", "quotedTotal"],
  dutyPayment: ["dutyPaymentLiability", "dutyAmount", "dutyPaidBy"],
  internalNotes: ["internalNotes"],
  documents: [],
} as const satisfies Record<string, readonly (keyof JobAutosaveInput)[]>;

// ---------------------------------------------------------------------------
// Submit — strict, keyed off shipmentType (mirrors enquirySubmitSchema).
// Re-validated from DB state by POST /api/jobs/[id]/submit, never the body.
// ---------------------------------------------------------------------------

export const jobSubmitSchema = jobAutosaveSchema
  .extend({
    shipmentType: shipmentTypeEnum,
    serviceTypes: z.array(serviceTypeEnum).min(1, "Select at least one service type"),
    incoterm: z.string().trim().min(1, "Incoterm is required"),
  })
  .superRefine((data, ctx) => {
    const require = (value: unknown, path: (string | number)[], message: string) => {
      if (value === null || value === undefined || value === "") {
        ctx.addIssue({ code: "custom", path, message });
      }
    };

    // Required for both Import and Export (source PDF pages 3 & 5).
    require(data.placeOfReceipt, ["placeOfReceipt"], "Place of Receipt is required");
    require(data.portOfLoading, ["portOfLoading"], "Port of Loading is required");
    require(data.portOfDischarge, ["portOfDischarge"], "Port of Discharge is required");
    require(data.placeOfDelivery, ["placeOfDelivery"], "Place of Delivery is required");
    require(data.shippingLineName, ["shippingLineName"], "Shipping Line is required");
    require(data.vesselName, ["vesselName"], "Vessel Name is required");
    require(data.voyageNumber, ["voyageNumber"], "Voyage No. is required");
    require(data.freeDaysAtPod, ["freeDaysAtPod"], "Free Days at POD is required");
    require(data.totalGrossWeight, ["totalGrossWeight"], "Total Gross Weight is required");
    require(data.totalPackages, ["totalPackages"], "No. of Packages is required");
    require(data.volumeCbm, ["volumeCbm"], "Volume (CBM) is required");
    require(data.shipperDetail?.name, ["shipperDetail", "name"], "Shipper Name is required");
    require(data.consigneeDetail?.name, ["consigneeDetail", "name"], "Consignee Name is required");
    require(data.notifyPartyDetail?.name, ["notifyPartyDetail", "name"], "Notify Party Name is required");

    // Import-only extras (Agent Details & CFS Name appear only in the Import
    // consignment list on PDF page 3).
    if (data.shipmentType === "IMPORT") {
      require(data.agentDetails, ["agentDetails"], "Agent Details are required");
      require(data.cfsName, ["cfsName"], "CFS Name is required");
    }

    // If container rows were added, each must at least name its type.
    (data.containers ?? []).forEach((c, i) => {
      if (!c.containerType) {
        ctx.addIssue({ code: "custom", path: ["containers", i, "containerType"], message: "Container Type is required" });
      }
    });
  });

// ---------------------------------------------------------------------------
// Bulk import (Stage 1 wizard extension)
// ---------------------------------------------------------------------------

export const JOB_TARGET_FIELDS: TargetField[] = [
  {
    key: "customerName",
    label: "Customer Name",
    required: true,
    synonyms: ["customer name", "customer", "client", "client name", "organisation", "organization", "party", "account"],
  },
  { key: "gstNumber", label: "Customer GST", synonyms: ["gst", "gstin", "gst no", "customer gst", "gst number"] },
  {
    key: "branch",
    label: "Branch",
    required: true,
    synonyms: ["branch", "branch name", "branch code", "office", "location"],
  },
  {
    key: "shipmentType",
    label: "Shipment Type",
    required: true,
    synonyms: ["shipment type", "type", "trade type", "import export", "direction", "im ex"],
  },
  { key: "serviceTypes", label: "Type of Service", synonyms: ["service", "services", "type of service", "service type"] },
  { key: "workflowStatus", label: "Workflow Status", required: true, synonyms: ["status", "job status", "workflow status", "current status", "stage"] },
  { key: "incoterm", label: "Incoterm", synonyms: ["incoterm", "inco term", "terms", "delivery terms"] },
  { key: "agentDetails", label: "Agent Details", synonyms: ["agent", "agent details", "overseas agent"] },
  { key: "placeOfReceipt", label: "Place of Receipt", synonyms: ["place of receipt", "por"] },
  { key: "portOfLoading", label: "Port of Loading", synonyms: ["port of loading", "pol", "load port", "origin port"] },
  { key: "portOfDischarge", label: "Port of Discharge", synonyms: ["port of discharge", "pod", "discharge port", "destination port"] },
  { key: "placeOfDelivery", label: "Place of Delivery", synonyms: ["place of delivery", "final destination", "delivery place"] },
  { key: "shippingLineName", label: "Shipping Line", synonyms: ["shipping line", "carrier", "line", "shipping line name"] },
  { key: "cfsName", label: "CFS Name", synonyms: ["cfs", "cfs name", "container freight station"] },
  { key: "vesselName", label: "Vessel Name", synonyms: ["vessel", "vessel name", "ship"] },
  { key: "voyageNumber", label: "Voyage No.", synonyms: ["voyage", "voyage no", "voy", "voyage number"] },
  { key: "freeDaysAtPod", label: "Free Days at POD", synonyms: ["free days", "free days at pod", "free time", "free days pod"] },
  { key: "containerType", label: "Container Type", synonyms: ["container type", "type of container", "equipment", "container"] },
  { key: "containerCount", label: "No. of Containers", synonyms: ["no of containers", "container count", "containers", "no of container", "container qty"] },
  { key: "totalGrossWeight", label: "Total Gross Weight", synonyms: ["gross weight", "total gross weight", "gwt", "weight"] },
  { key: "totalNetWeight", label: "Total Net Weight", synonyms: ["net weight", "total net weight", "nwt"] },
  { key: "totalPackages", label: "No. of Packages", synonyms: ["packages", "no of packages", "package count", "pkgs", "pieces"] },
  { key: "volumeCbm", label: "Volume (CBM)", synonyms: ["cbm", "volume", "volume cbm", "measurement"] },
  { key: "commodity", label: "Commodity", synonyms: ["commodity", "cargo", "goods", "cargo description"] },
  { key: "hsCode", label: "HS Code", synonyms: ["hs code", "hsn", "hs", "tariff", "hs code no"] },
  { key: "shipperName", label: "Shipper Name", synonyms: ["shipper", "shipper name", "exporter"] },
  { key: "shipperAddress", label: "Shipper Address", synonyms: ["shipper address"] },
  { key: "consigneeName", label: "Consignee Name", synonyms: ["consignee", "consignee name", "importer"] },
  { key: "consigneeAddress", label: "Consignee Address", synonyms: ["consignee address"] },
  { key: "notifyName", label: "Notify Party Name", synonyms: ["notify", "notify party", "notify name"] },
];

// Free-text workflow-status column -> JobStatus. Blank maps to
// WORKFLOW_IN_PROGRESS (historical jobs are typically active/closed); a
// non-blank value that isn't recognised is a row error.
const JOB_IMPORT_STATUS_MAP: Record<string, JobStatusValue> = {
  "workflow in progress": "WORKFLOW_IN_PROGRESS",
  "in progress": "WORKFLOW_IN_PROGRESS",
  "inprogress": "WORKFLOW_IN_PROGRESS",
  ongoing: "WORKFLOW_IN_PROGRESS",
  open: "WORKFLOW_IN_PROGRESS",
  active: "WORKFLOW_IN_PROGRESS",
  wip: "WORKFLOW_IN_PROGRESS",
  completed: "COMPLETED",
  complete: "COMPLETED",
  delivered: "COMPLETED",
  closed: "COMPLETED",
  done: "COMPLETED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

export function resolveImportJobStatus(raw: string): JobStatusValue | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "WORKFLOW_IN_PROGRESS";
  return JOB_IMPORT_STATUS_MAP[v] ?? null;
}

export function parseImportNumber(raw: string): number | null {
  const v = raw.trim().replace(/,/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const SERVICE_TYPE_TOKENS: Record<string, string> = {
  ff: "FREIGHT_FORWARDING",
  "freight forwarding": "FREIGHT_FORWARDING",
  freight: "FREIGHT_FORWARDING",
  cc: "CUSTOMS_CLEARANCE",
  "customs clearance": "CUSTOMS_CLEARANCE",
  customs: "CUSTOMS_CLEARANCE",
  tpt: "TRANSPORTATION",
  transportation: "TRANSPORTATION",
  transport: "TRANSPORTATION",
  wh: "WAREHOUSING",
  warehousing: "WAREHOUSING",
  ec: "EXIM_CONSULTANCY",
  "exim consultancy": "EXIM_CONSULTANCY",
};

export function parseImportServiceTypes(raw: string): string[] {
  const out = new Set<string>();
  for (const token of raw
    .split(/[,;/|]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)) {
    const mapped = SERVICE_TYPE_TOKENS[token];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

const IMPORT_SHIPMENT_TYPES: Record<string, "IMPORT" | "EXPORT"> = {
  import: "IMPORT",
  imp: "IMPORT",
  in: "IMPORT",
  inbound: "IMPORT",
  export: "EXPORT",
  exp: "EXPORT",
  out: "EXPORT",
  outbound: "EXPORT",
};

export function resolveImportShipmentType(raw: string): "IMPORT" | "EXPORT" | null {
  return IMPORT_SHIPMENT_TYPES[raw.trim().toLowerCase()] ?? null;
}
