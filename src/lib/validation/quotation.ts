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

export const createQuotationSchema = z.object({
  organizationId: z.string().min(1, "Customer is required"),
  enquiryIds: z.array(z.string().min(1)).min(1, "Select at least one enquiry"),
});

const lineItemSchema = z.object({
  category: z.enum(["FREIGHT", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "REIMBURSEMENT"]),
  description: z.string().trim().min(1, "Description is required"),
  rate: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  amount: z.number(),
  currency: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
});

export type QuotationLineItemInput = z.infer<typeof lineItemSchema>;

// Replace-all payload for the current version's line items — same "replace
// children wholesale" convention as Customer Master v2's branches/bill-types.
export const lineItemsReplaceSchema = z.object({
  currency: z.string().trim().min(1),
  lineItems: z.array(lineItemSchema),
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().optional(),
});

export const customerApprovalSchema = z.object({
  note: z.string().trim().optional(),
});
