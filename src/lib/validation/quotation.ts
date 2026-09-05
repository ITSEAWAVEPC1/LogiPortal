import { z } from "zod";

export const QUOTATION_CHARGE_CATEGORY_OPTIONS = [
  { value: "FREIGHT", label: "Freight Charges" },
  { value: "CUSTOMS_CLEARANCE", label: "Customs Clearance Charges" },
  { value: "TRANSPORTATION", label: "Transportation Charges" },
  { value: "REIMBURSEMENT", label: "Reimbursement Charges" },
] as const;

// Unified reference: prefer the stored RFQ-DDMMYY-NNNN string (inherited from the
// primary bundled Enquiry); fall back to the legacy computed QUO-YYYY-NNNN for
// rows created before the reference backfill.
export function formatQuotationRef(row: {
  referenceNo?: string | null;
  createdAt: string | Date;
  sequenceNumber: number;
}): string {
  if (row.referenceNo) return row.referenceNo;
  const year = new Date(row.createdAt).getFullYear();
  return `QUO-${year}-${String(row.sequenceNumber).padStart(4, "0")}`;
}

// Stage 12d — single-select only (a Quotation now bundles exactly one
// Enquiry). QuotationEnquiry's join-table shape is unchanged (still
// technically many-to-many), just constrained to one row per Quotation here.
export const createQuotationSchema = z.object({
  organizationId: z.string().min(1, "Customer is required"),
  enquiryId: z.string().min(1, "Select an enquiry"),
});

// Stage 12d — currency moved to per-line (each row picks its own, default
// INR); exchangeRate/rateInr are only meaningful when currency != "INR".
// remarks is free text, optional.
const lineItemSchema = z.object({
  category: z.enum(["FREIGHT", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "REIMBURSEMENT"]),
  description: z.string().trim().min(1, "Description is required"),
  rate: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  amount: z.number(),
  currency: z.string().trim().min(1),
  exchangeRate: z.number().nullable().optional(),
  rateInr: z.number().nullable().optional(),
  remarks: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export type QuotationLineItemInput = z.infer<typeof lineItemSchema>;

// Replace-all payload for the current version's line items — same "replace
// children wholesale" convention as Customer Master v2's branches/bill-types.
// No top-level currency any more — the version's total is always INR (each
// line converts on its own via rateInr), so there's nothing for the client
// to choose at the version level.
export const lineItemsReplaceSchema = z.object({
  lineItems: z.array(lineItemSchema),
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().optional(),
});

export const customerApprovalSchema = z.object({
  note: z.string().trim().optional(),
});
