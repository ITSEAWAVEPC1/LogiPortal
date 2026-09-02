import { z } from "zod";

export const DOCUMENT_KINDS = ["HBL", "MBL", "FREIGHT_CERTIFICATE", "DELIVERY_ORDER", "INVOICE", "OTHER"] as const;
export type DocumentKindValue = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

// Uploaded file limits — mirrors src/app/api/data-import/upload/route.ts.
export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const ACCEPTED_UPLOAD_ACCEPT = ".pdf,.png,.jpg,.jpeg";

export function formatDocumentRef(createdAt: string | Date, sequenceNumber: number): string {
  const year = new Date(createdAt).getFullYear();
  return `DOC-${year}-${String(sequenceNumber).padStart(4, "0")}`;
}

// JSON body — "generate" mode (a generatable built-in type).
export const documentGenerateSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  documentTypeCode: z.string().trim().min(1, "Document type is required"),
  jobWorkflowProgressId: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
});

// multipart form fields — "upload" mode. The File itself is validated in the
// route (size / mime); this covers the sidecar text fields.
export const documentUploadMetaSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  documentTypeCode: z.string().trim().min(1, "Document type is required"),
  jobWorkflowProgressId: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
});

export const documentReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    note: z.string().trim().optional(),
  })
  .refine((v) => v.action !== "reject" || (v.note && v.note.length > 0), {
    message: "A note is required when rejecting a document",
    path: ["note"],
  });

export const documentPatchSchema = z
  .object({
    sharedWithCustomer: z.boolean().optional(),
    title: z.string().trim().min(1).optional(),
    isActive: z.literal(false).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// New-version body ("regenerate" mode). An uploaded new version comes in as
// multipart and reuses documentUploadMetaSchema minus jobId/type.
export const documentVersionSchema = z.object({
  mode: z.literal("regenerate"),
});

// Document Type master (admin) — BillType twin. User-added types are always
// upload-only OTHER; the 5 generatable built-ins are seed-only.
function toCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export const documentTypeCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    code: z.string().trim().optional().or(z.literal("")),
    customerVisibleDefault: z.boolean().optional(),
  })
  .transform((v) => ({
    name: v.name,
    code: toCode(v.code || v.name),
    kind: "OTHER" as const,
    isFinancial: false,
    isGeneratable: false,
    customerVisibleDefault: v.customerVisibleDefault ?? false,
  }))
  .refine((v) => v.code.length > 0, { message: "Could not derive a code from the name", path: ["code"] });

export const documentTypeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    customerVisibleDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
