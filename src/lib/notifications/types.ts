import type { NotificationType } from "@/generated/prisma/client";

// The 16 NotificationType values as a runtime array (the generated enum is
// types-only), for zod validation + the preference form's mute checklist.
export const NOTIFICATION_TYPES = [
  "WORKFLOW_STEP_SUBMITTED",
  "WORKFLOW_STEP_APPROVED",
  "WORKFLOW_STEP_REJECTED",
  "JOB_WORKFLOW_STARTED",
  "JOB_COMPLETED",
  "ENQUIRY_READY",
  "ENQUIRY_NEEDS_CORRECTION",
  "QUOTATION_SUBMITTED",
  "QUOTATION_APPROVED",
  "QUOTATION_NEEDS_CORRECTION",
  "QUOTATION_SENT",
  "QUOTATION_CUSTOMER_APPROVED",
  "DOCUMENT_SUBMITTED",
  "DOCUMENT_APPROVED",
  "DOCUMENT_REJECTED",
  "DOCUMENT_SHARED",
] as const satisfies readonly NotificationType[];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  WORKFLOW_STEP_SUBMITTED: "Workflow step submitted for my approval",
  WORKFLOW_STEP_APPROVED: "Workflow step approved",
  WORKFLOW_STEP_REJECTED: "Workflow step sent back",
  JOB_WORKFLOW_STARTED: "Job workflow started",
  JOB_COMPLETED: "Job delivered",
  ENQUIRY_READY: "Enquiry marked ready for quotation",
  ENQUIRY_NEEDS_CORRECTION: "Enquiry sent back for correction",
  QUOTATION_SUBMITTED: "Quotation submitted for approval",
  QUOTATION_APPROVED: "Quotation approved",
  QUOTATION_NEEDS_CORRECTION: "Quotation sent back for correction",
  QUOTATION_SENT: "Quotation sent to customer",
  QUOTATION_CUSTOMER_APPROVED: "Customer approved a quotation",
  DOCUMENT_SUBMITTED: "Document submitted for approval",
  DOCUMENT_APPROVED: "Document approved",
  DOCUMENT_REJECTED: "Document rejected",
  DOCUMENT_SHARED: "Document shared with customer",
};

export function isNotificationType(v: string): v is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(v);
}
