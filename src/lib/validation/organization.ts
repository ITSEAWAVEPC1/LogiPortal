import { z } from "zod";
import { GST_REGEX, PAN_REGEX, TAN_REGEX, normalizeGst, normalizePan, normalizeTan } from "./kyc";

// Shared by the interactive Customer form (src/app/api/customers/route.ts) and
// the bulk import validator (src/lib/import/validate-customer-rows.ts) — one
// implementation, not two. GST/PAN/TAN are optional at creation (Section 5.1
// has no approval gate; real onboarding often starts before GST is on hand)
// but validated when present.
export const organizationInputSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  alias: z.string().trim().optional().or(z.literal("")),
  contactPersonName: z.string().trim().optional().or(z.literal("")),
  contactPersonPhone: z.string().trim().optional().or(z.literal("")),
  contactPersonEmail: z.email("Invalid email").optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  branchId: z.string().trim().optional().or(z.literal("")),
  // One Organization record can play multiple roles at once (Customer Master
  // v2) — all optional/defaulted so the bulk importer's existing rows (which
  // never supply these) keep validating unchanged.
  isShipper: z.boolean().optional().default(false),
  isConsignee: z.boolean().optional().default(false),
  isAgent: z.boolean().optional().default(false),
  isCarrier: z.boolean().optional().default(false),
  isService: z.boolean().optional().default(false),
  isGlobal: z.boolean().optional().default(false),
  defaultCurrency: z.string().trim().optional().or(z.literal("")),
  gstNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || GST_REGEX.test(normalizeGst(v)), { message: "Invalid GST number format" }),
  panNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || PAN_REGEX.test(normalizePan(v)), { message: "Invalid PAN number format" }),
  tanNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || TAN_REGEX.test(normalizeTan(v)), { message: "Invalid TAN number format" }),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
