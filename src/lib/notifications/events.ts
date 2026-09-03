// Stage 10c — event → recipient builders. Each returns NotificationInput[] with
// the actor removed and user ids de-duped. Routes call one or more builders
// after their $transaction commits, collect the inputs, and hand them to
// fireAfterResponse() (src/lib/notifications/fire.ts).

import { prisma } from "@/lib/db/prisma";
import type { NotificationType, Prisma, Role } from "@/generated/prisma/client";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath?: string;
  data?: Prisma.InputJsonValue;
}

async function activeUsersWithRoleInBranch(role: Role, branchId: string | null): Promise<string[]> {
  if (!branchId) return [];
  const users = await prisma.user.findMany({
    where: { role, branchId, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function customerUserIdsForOrg(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: "CUSTOMER", organizationId, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

function build(
  recipients: Array<string | null | undefined>,
  actorId: string,
  fields: Omit<NotificationInput, "userId">,
): NotificationInput[] {
  const seen = new Set<string>();
  const out: NotificationInput[] = [];
  for (const id of recipients) {
    if (!id || id === actorId || seen.has(id)) continue;
    seen.add(id);
    out.push({ userId: id, ...fields });
  }
  return out;
}

// --- workflow steps -------------------------------------------------------

export async function workflowStepSubmitted(a: {
  jobId: string;
  jobRef: string;
  branchId: string;
  stepLabel: string;
  approverRole: Role;
  actorId: string;
}): Promise<NotificationInput[]> {
  const approvers = await activeUsersWithRoleInBranch(a.approverRole, a.branchId);
  return build(approvers, a.actorId, {
    type: "WORKFLOW_STEP_SUBMITTED",
    title: `Step awaiting your approval — ${a.jobRef}`,
    body: `"${a.stepLabel}" was submitted for approval on job ${a.jobRef}.`,
    linkPath: `/jobs/${a.jobId}`,
  });
}

export async function workflowStepReviewed(a: {
  jobId: string;
  jobRef: string;
  branchId: string;
  stepLabel: string;
  decision: "approved" | "rejected";
  ownerUserId: string | null;
  nextOwnerRole: Role | null;
  actorId: string;
  note?: string;
}): Promise<NotificationInput[]> {
  if (a.decision === "rejected") {
    return build([a.ownerUserId], a.actorId, {
      type: "WORKFLOW_STEP_REJECTED",
      title: `Step sent back — ${a.jobRef}`,
      body: `"${a.stepLabel}" on job ${a.jobRef} was sent back for correction${a.note ? `: ${a.note}` : "."}`,
      linkPath: `/jobs/${a.jobId}`,
      data: a.note ? { note: a.note } : undefined,
    });
  }
  const nextOwners = a.nextOwnerRole
    ? await activeUsersWithRoleInBranch(a.nextOwnerRole, a.branchId)
    : [];
  return build([a.ownerUserId, ...nextOwners], a.actorId, {
    type: "WORKFLOW_STEP_APPROVED",
    title: `Step approved — ${a.jobRef}`,
    body: `"${a.stepLabel}" on job ${a.jobRef} was approved.`,
    linkPath: `/jobs/${a.jobId}`,
  });
}

export async function jobWorkflowStarted(a: {
  jobId: string;
  jobRef: string;
  branchId: string;
  jobCreatedById: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const doers = await activeUsersWithRoleInBranch("DOER", a.branchId);
  return build([a.jobCreatedById, ...doers], a.actorId, {
    type: "JOB_WORKFLOW_STARTED",
    title: `Workflow started — ${a.jobRef}`,
    body: `Job ${a.jobRef} was approved and its workflow is now in progress.`,
    linkPath: `/jobs/${a.jobId}`,
  });
}

export async function jobCompleted(a: {
  jobId: string;
  jobRef: string;
  branchId: string;
  organizationId: string;
  jobCreatedById: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const [accounts, customers] = await Promise.all([
    activeUsersWithRoleInBranch("ACCOUNTS", a.branchId),
    customerUserIdsForOrg(a.organizationId),
  ]);
  return [
    ...build([a.jobCreatedById, ...accounts], a.actorId, {
      type: "JOB_COMPLETED",
      title: `Job delivered — ${a.jobRef}`,
      body: `Job ${a.jobRef} has been marked delivered.`,
      linkPath: `/jobs/${a.jobId}`,
    }),
    ...build(customers, a.actorId, {
      type: "JOB_COMPLETED",
      title: `Your shipment has been delivered — ${a.jobRef}`,
      body: `Shipment ${a.jobRef} has been marked delivered.`,
      linkPath: `/portal/jobs/${a.jobId}`,
    }),
  ];
}

// --- enquiry ------------------------------------------------------------

export function enquiryReviewed(a: {
  enquiryId: string;
  enquiryRef: string;
  decision: "ready" | "needs_correction";
  doerId: string;
  actorId: string;
  note?: string;
}): NotificationInput[] {
  const ready = a.decision === "ready";
  return build([a.doerId], a.actorId, {
    type: ready ? "ENQUIRY_READY" : "ENQUIRY_NEEDS_CORRECTION",
    title: ready
      ? `Enquiry ready for quotation — ${a.enquiryRef}`
      : `Enquiry sent back — ${a.enquiryRef}`,
    body: ready
      ? `Enquiry ${a.enquiryRef} was marked ready for quotation.`
      : `Enquiry ${a.enquiryRef} needs correction${a.note ? `: ${a.note}` : "."}`,
    linkPath: `/enquiries/${a.enquiryId}`,
    data: a.note ? { note: a.note } : undefined,
  });
}

// --- quotation --------------------------------------------------------

export async function quotationSubmitted(a: {
  quotationId: string;
  quotationRef: string;
  branchId: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const managers = await activeUsersWithRoleInBranch("BRANCH_MANAGER", a.branchId);
  return build(managers, a.actorId, {
    type: "QUOTATION_SUBMITTED",
    title: `Quotation awaiting approval — ${a.quotationRef}`,
    body: `Quotation ${a.quotationRef} was submitted for approval.`,
    linkPath: `/quotations/${a.quotationId}`,
  });
}

export function quotationReviewed(a: {
  quotationId: string;
  quotationRef: string;
  decision: "approved" | "needs_correction";
  createdById: string;
  actorId: string;
  note?: string;
}): NotificationInput[] {
  const approved = a.decision === "approved";
  return build([a.createdById], a.actorId, {
    type: approved ? "QUOTATION_APPROVED" : "QUOTATION_NEEDS_CORRECTION",
    title: approved
      ? `Quotation approved — ${a.quotationRef}`
      : `Quotation sent back — ${a.quotationRef}`,
    body: approved
      ? `Quotation ${a.quotationRef} was approved and can now be sent.`
      : `Quotation ${a.quotationRef} needs correction${a.note ? `: ${a.note}` : "."}`,
    linkPath: `/quotations/${a.quotationId}`,
    data: a.note ? { note: a.note } : undefined,
  });
}

export function quotationCustomerApproved(a: {
  quotationId: string;
  quotationRef: string;
  createdById: string;
  actorId: string;
}): NotificationInput[] {
  return build([a.createdById], a.actorId, {
    type: "QUOTATION_CUSTOMER_APPROVED",
    title: `Customer approved quotation — ${a.quotationRef}`,
    body: `The customer approved quotation ${a.quotationRef}. It can be converted to a job.`,
    linkPath: `/quotations/${a.quotationId}`,
  });
}

export async function quotationSent(a: {
  quotationId: string;
  quotationRef: string;
  organizationId: string;
  createdById: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const customers = await customerUserIdsForOrg(a.organizationId);
  return [
    ...build([a.createdById], a.actorId, {
      type: "QUOTATION_SENT",
      title: `Quotation sent — ${a.quotationRef}`,
      body: `Quotation ${a.quotationRef} was marked sent to the customer.`,
      linkPath: `/quotations/${a.quotationId}`,
    }),
    ...build(customers, a.actorId, {
      type: "QUOTATION_SENT",
      title: `New quotation — ${a.quotationRef}`,
      body: `Quotation ${a.quotationRef} is ready for your review.`,
      linkPath: `/portal/quotations/${a.quotationId}`,
    }),
  ];
}

// --- documents -------------------------------------------------------

export async function documentSubmitted(a: {
  documentId: string;
  jobId: string;
  jobRef: string;
  branchId: string;
  docTitle: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const managers = await activeUsersWithRoleInBranch("BRANCH_MANAGER", a.branchId);
  return build(managers, a.actorId, {
    type: "DOCUMENT_SUBMITTED",
    title: `Document awaiting approval — ${a.jobRef}`,
    body: `"${a.docTitle}" on job ${a.jobRef} was submitted for approval.`,
    linkPath: `/jobs/${a.jobId}`,
  });
}

export function documentReviewed(a: {
  documentId: string;
  jobId: string;
  jobRef: string;
  decision: "approved" | "rejected";
  createdById: string;
  docTitle: string;
  actorId: string;
  note?: string;
}): NotificationInput[] {
  const approved = a.decision === "approved";
  return build([a.createdById], a.actorId, {
    type: approved ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
    title: approved
      ? `Document approved — ${a.jobRef}`
      : `Document rejected — ${a.jobRef}`,
    body: approved
      ? `"${a.docTitle}" on job ${a.jobRef} was approved.`
      : `"${a.docTitle}" on job ${a.jobRef} was rejected${a.note ? `: ${a.note}` : "."}`,
    linkPath: `/jobs/${a.jobId}`,
    data: a.note ? { note: a.note } : undefined,
  });
}

export async function documentShared(a: {
  documentId: string;
  jobId: string;
  jobRef: string;
  organizationId: string;
  docTitle: string;
  actorId: string;
}): Promise<NotificationInput[]> {
  const customers = await customerUserIdsForOrg(a.organizationId);
  return build(customers, a.actorId, {
    type: "DOCUMENT_SHARED",
    title: `New document shared — ${a.jobRef}`,
    body: `"${a.docTitle}" for shipment ${a.jobRef} is now available.`,
    linkPath: `/portal/documents`,
  });
}
