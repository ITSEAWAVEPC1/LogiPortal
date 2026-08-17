import { z } from "zod";
import { organizationInputSchema } from "./organization";

// Nested schemas for Customer Master v2's rich Organization editor
// (branches, addresses, contacts, account managers, bank accounts, Account
// Info, Billing). `id` is accepted but unused by the write path — branches
// and their children are replaced wholesale on every save (see the
// /api/customers route's transaction), not diffed row-by-row.

export const branchAddressInputSchema = z.object({
  addressType: z.string().trim().min(1, "Address type is required"),
  name: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  postalCode: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  telephone: z.string().trim().optional().or(z.literal("")),
  fax: z.string().trim().optional().or(z.literal("")),
  email: z.email("Invalid email").optional().or(z.literal("")),
});

export const branchContactInputSchema = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  titleDesignation: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  mobile: z.string().trim().optional().or(z.literal("")),
  telephone: z.string().trim().optional().or(z.literal("")),
  email: z.email("Invalid email").optional().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
});

export const branchAccountManagerInputSchema = z.object({
  forCategory: z.string().trim().min(1, "Category is required"),
  managerUserId: z.string().trim().optional().or(z.literal("")),
});

export const bankAccountInputSchema = z.object({
  accountKind: z.enum(["PAYABLE", "RECEIVABLE"]),
  bankName: z.string().trim().min(1, "Bank name is required"),
  bankBranch: z.string().trim().optional().or(z.literal("")),
  accountNumber: z.string().trim().min(1, "Account number is required"),
  ifsc: z.string().trim().optional().or(z.literal("")),
  transactionCurrency: z.string().trim().optional().or(z.literal("")),
});

export const organizationBranchInputSchema = z.object({
  branchName: z.string().trim().min(1, "Branch name is required"),
  address: z.string().trim().optional().or(z.literal("")),
  isDefault: z.boolean().optional().default(false),
  isDeactivated: z.boolean().optional().default(false),
  country: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  postalCode: z.string().trim().optional().or(z.literal("")),
  telephone: z.string().trim().optional().or(z.literal("")),
  fax: z.string().trim().optional().or(z.literal("")),
  website: z.string().trim().optional().or(z.literal("")),
  email: z.email("Invalid email").optional().or(z.literal("")),
  salesPersonId: z.string().trim().optional().or(z.literal("")),
  lobWise: z.boolean().optional().default(false),
  collectionExecutiveId: z.string().trim().optional().or(z.literal("")),
  taxableType: z.string().trim().optional().default("Standard"),
  addresses: z.array(branchAddressInputSchema).default([]),
  contacts: z.array(branchContactInputSchema).default([]),
  accountManagers: z.array(branchAccountManagerInputSchema).default([]),
  bankAccounts: z.array(bankAccountInputSchema).default([]),
});

export const customerAccountInfoInputSchema = z.object({
  creditLimit: z.number().nonnegative().default(0),
  isUnlimitedCredit: z.boolean().default(false),
  cashOnDelivery: z.boolean().default(false),
  includeWipShipmentInOverdue: z.boolean().default(false),
  isCreditOnHold: z.boolean().default(false),
  creditOnHoldRemark: z.string().trim().optional().or(z.literal("")),
  receivableCreditPeriodDays: z.number().int().nonnegative().optional(),
  customerGLCode: z.string().trim().optional().or(z.literal("")),
  notificationEmails: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().optional().or(z.literal("")),
  tdsReceivable: z.boolean().default(false),
});

export const vendorAccountInfoInputSchema = z.object({
  creditLimit: z.number().nonnegative().default(0),
  isUnlimitedCredit: z.boolean().default(false),
  payableCreditPeriodDays: z.number().int().nonnegative().optional(),
  dueDateCalculatedOn: z.enum(["TRANSACTION_DATE", "INVOICE_DATE", "BILL_DATE"]).default("TRANSACTION_DATE"),
  vendorGLCode: z.string().trim().optional().or(z.literal("")),
  notificationEmails: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().optional().or(z.literal("")),
  isPaymentOnHold: z.boolean().default(false),
  tdsPayable: z.boolean().default(false),
});

export const organizationBillTypeInputSchema = z
  .object({
    billTypeId: z.string().trim().min(1, "Bill type is required"),
    dueAfterDays: z.number().int().nonnegative().optional(),
    overrideCreditPeriod: z.boolean().default(false),
    billTo: z.enum(["DIRECT", "OTHER"]).default("DIRECT"),
    billToOrganizationId: z.string().trim().optional().or(z.literal("")),
    clubCharges: z.enum(["NO_GROUPING", "GROUP_BY_SHIPMENT", "GROUP_BY_JOB"]).default("NO_GROUPING"),
  })
  .refine((v) => v.billTo !== "OTHER" || !!v.billToOrganizationId, {
    message: "Bill To Organization is required when Bill To is Other",
    path: ["billToOrganizationId"],
  });

export const organizationDetailInputSchema = organizationInputSchema.extend({
  branches: z.array(organizationBranchInputSchema).default([]),
  customerAccountInfo: customerAccountInfoInputSchema.optional().nullable(),
  vendorAccountInfo: vendorAccountInfoInputSchema.optional().nullable(),
  billTypes: z.array(organizationBillTypeInputSchema).default([]),
});

export type OrganizationDetailInput = z.infer<typeof organizationDetailInputSchema>;
