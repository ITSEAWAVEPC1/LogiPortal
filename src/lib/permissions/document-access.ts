import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "./roles";

// ---------------------------------------------------------------------------
// Stage 7 — the Section 4.3 "Documents" row nuance layer.
//
// capabilities.ts is the coarse gate (can this role reach the documents screen
// / API at all). This module encodes what the flat view/create/edit/approve
// capability can't: Sales sees non-financial documents only; Accounts is the
// role allowed to create *financial* documents; the Branch Manager approves
// and shares but does not upload; a Customer sees only APPROVED +
// sharedWithCustomer documents for their own organisation's jobs.
//
// Pure (no prisma) so it stays trivially unit-testable — the customer's
// organisation id is resolved in the route/page and passed in. Mirrors the
// job-fields.ts / organization-sections.ts pattern.
// ---------------------------------------------------------------------------

export interface DocumentAccess {
  canView: boolean;
  /** May create a non-financial document (generate or upload). */
  canCreate: boolean;
  /** May create a financial document (INVOICE / FREIGHT_CERTIFICATE). */
  canCreateFinancial: boolean;
  /** May approve / reject the Branch-Manager gate. */
  canApprove: boolean;
  /** May toggle sharedWithCustomer. */
  canShareToggle: boolean;
  /** May soft-delete (PATCH { isActive: false }). */
  canDeactivate: boolean;
  /** May rename / regenerate / add a version — still checked per-document
   *  (creator-or-Admin) in the route; this is the role-level pre-check. */
  canEditMeta: boolean;
  /** Financial documents are visible at all. */
  seesFinancial: boolean;
  /** Only APPROVED + sharedWithCustomer documents are visible. */
  onlyApprovedShared: boolean;
  /** Visibility is restricted to the viewer's own organisation's jobs. */
  orgScoped: boolean;
}

const ACCESS: Record<Role, DocumentAccess> = {
  ADMIN: {
    canView: true,
    canCreate: true,
    canCreateFinancial: true,
    canApprove: true,
    canShareToggle: true,
    canDeactivate: true,
    canEditMeta: true,
    seesFinancial: true,
    onlyApprovedShared: false,
    orgScoped: false,
  },
  BRANCH_MANAGER: {
    canView: true,
    canCreate: false,
    canCreateFinancial: false,
    canApprove: true,
    canShareToggle: true,
    canDeactivate: false,
    canEditMeta: false,
    seesFinancial: true,
    onlyApprovedShared: false,
    orgScoped: false,
  },
  DOER: {
    canView: true,
    canCreate: true,
    canCreateFinancial: false,
    canApprove: false,
    canShareToggle: false,
    canDeactivate: false,
    canEditMeta: true,
    seesFinancial: true,
    onlyApprovedShared: false,
    orgScoped: false,
  },
  SALES: {
    canView: true,
    canCreate: false,
    canCreateFinancial: false,
    canApprove: false,
    canShareToggle: false,
    canDeactivate: false,
    canEditMeta: false,
    seesFinancial: false,
    onlyApprovedShared: false,
    orgScoped: false,
  },
  ACCOUNTS: {
    canView: true,
    canCreate: true,
    canCreateFinancial: true,
    canApprove: false,
    canShareToggle: false,
    canDeactivate: false,
    canEditMeta: true,
    seesFinancial: true,
    onlyApprovedShared: false,
    orgScoped: false,
  },
  CUSTOMER: {
    canView: true,
    canCreate: false,
    canCreateFinancial: false,
    canApprove: false,
    canShareToggle: false,
    canDeactivate: false,
    canEditMeta: false,
    // A shared invoice is financial *and* meant for the customer — the
    // onlyApprovedShared + orgScoped clauses are what actually confine them.
    seesFinancial: true,
    onlyApprovedShared: true,
    orgScoped: true,
  },
};

export function getDocumentAccess(role: Role): DocumentAccess {
  return ACCESS[role];
}

// Sentinel org id for a CUSTOMER with no organisation link yet — matches
// nothing, so they see an empty repository rather than everything.
const NO_ORG = "__no_org__";

/**
 * The list-query WHERE for a role. `organizationId` is the CUSTOMER's linked
 * org (null for every other role, and for an unlinked customer). `extra` is
 * merged in (e.g. { jobId }, { kind }, { status }).
 */
export function buildDocumentListWhere(
  role: Role,
  organizationId: string | null,
  extra?: Prisma.DocumentWhereInput,
): Prisma.DocumentWhereInput {
  const access = ACCESS[role];
  const AND: Prisma.DocumentWhereInput[] = [{ isActive: true }];
  if (extra) AND.push(extra);
  if (!access.seesFinancial) AND.push({ isFinancial: false });
  if (access.onlyApprovedShared) AND.push({ status: "APPROVED", sharedWithCustomer: true });
  if (access.orgScoped) AND.push({ job: { organizationId: organizationId ?? NO_ORG } });
  return { AND };
}

interface ReadableDocShape {
  isActive: boolean;
  isFinancial: boolean;
  status: string;
  sharedWithCustomer: boolean;
  job: { organizationId: string };
}

/** Single-document read check for GET /api/documents/[id] and the file route. */
export function canReadDocument(
  role: Role,
  organizationId: string | null,
  doc: ReadableDocShape,
): boolean {
  const access = ACCESS[role];
  if (!access.canView) return false;
  if (!doc.isActive && role !== "ADMIN") return false;
  if (!access.seesFinancial && doc.isFinancial) return false;
  if (access.onlyApprovedShared && !(doc.status === "APPROVED" && doc.sharedWithCustomer)) return false;
  if (access.orgScoped && doc.job.organizationId !== organizationId) return false;
  return true;
}

/** True if `role` may create a document of the given financial-ness. */
export function canCreateDocument(role: Role, isFinancial: boolean): boolean {
  const access = ACCESS[role];
  return isFinancial ? access.canCreateFinancial : access.canCreate;
}
