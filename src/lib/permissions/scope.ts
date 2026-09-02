import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "./roles";

// ---------------------------------------------------------------------------
// Stage 10a — row-scoping for the Dashboard, Reports, and the Audit viewer.
//
// This is the FOURTH permission mechanism, kept deliberately separate from the
// other three (access-matrix.ts = nav visibility, capabilities.ts = per-action,
// field-permissions.ts = per-field-group). It answers a different question:
// "which branches / records may this user's aggregate view include?"
//
// docs/platform-development-plan.md §4.2 scopes Dashboard and Reports
// DIFFERENTLY, so there are two entry points:
//
//   Screen      ADMIN  BRANCH_MANAGER  DOER    SALES         ACCOUNTS
//   Dashboard   ALL    own branch      branch  branch        branch (financial)
//   Reports     ALL    own branch      —       own records   ALL (financial)
//
// A BRANCH scope with no branch ids (a manager whose User.branchId is null —
// untested; every seed user is on Mumbai) resolves to "matches nothing", the
// same fail-closed stance as portal/guard.ts's NO_ORG sentinel.
// ---------------------------------------------------------------------------

/** Sentinel branch id — an `{ in: [NO_BRANCH] }` clause matches no rows. */
export const NO_BRANCH = "__no_branch__";

export type Scope =
  | { kind: "ALL" }
  | { kind: "BRANCH"; branchIds: string[] }
  | { kind: "OWN"; userId: string };

export interface ScopeUser {
  role: Role;
  id: string;
  branchId: string | null;
}

function branchScope(u: ScopeUser): Scope {
  return { kind: "BRANCH", branchIds: u.branchId ? [u.branchId] : [] };
}

/**
 * Scope for the internal /dashboard. ADMIN sees every branch; every other
 * internal role is confined to their own branch. CUSTOMER never reaches the
 * dashboard (the (dashboard) layout redirects them to /portal) — calling this
 * with a CUSTOMER is a programming error.
 */
export function dashboardScope(u: ScopeUser): Scope {
  switch (u.role) {
    case "ADMIN":
      return { kind: "ALL" };
    case "BRANCH_MANAGER":
    case "DOER":
    case "SALES":
    case "ACCOUNTS":
      return branchScope(u);
    case "CUSTOMER":
      throw new Error("dashboardScope: CUSTOMER has no internal dashboard");
  }
}

/** Roles allowed on the Reports screen at all (plan §4.2). */
export function assertReportAccess(role: Role): void {
  if (role === "DOER" || role === "CUSTOMER") {
    throw new Error(`reportScope: ${role} has no access to Reports`);
  }
}

/**
 * Scope for a Reports query. ADMIN and ACCOUNTS see all branches; BRANCH_MANAGER
 * is confined to their branch; SALES sees only records they own (enquiries by
 * doerId, quotations by createdById). Throws for DOER / CUSTOMER — call
 * assertReportAccess()/canAccessScreen() first to turn that into a redirect.
 */
export function reportScope(u: ScopeUser): Scope {
  assertReportAccess(u.role);
  switch (u.role) {
    case "ADMIN":
    case "ACCOUNTS":
      return { kind: "ALL" };
    case "BRANCH_MANAGER":
      return branchScope(u);
    case "SALES":
      return { kind: "OWN", userId: u.id };
    default:
      // unreachable — assertReportAccess() has already rejected DOER/CUSTOMER
      throw new Error(`reportScope: unexpected role ${u.role}`);
  }
}

// --- WHERE-fragment builders ------------------------------------------------
// Each returns a fragment to spread into a Prisma `where`. BRANCH with an empty
// list becomes `{ in: [NO_BRANCH] }` — a valid clause that matches nothing.

function branchIn(branchIds: string[]): { in: string[] } {
  return { in: branchIds.length ? branchIds : [NO_BRANCH] };
}

export function jobScopeWhere(s: Scope): Prisma.JobWhereInput {
  switch (s.kind) {
    case "ALL":
      return {};
    case "BRANCH":
      return { branchId: branchIn(s.branchIds) };
    case "OWN":
      return { createdById: s.userId };
  }
}

export function enquiryScopeWhere(s: Scope): Prisma.EnquiryWhereInput {
  switch (s.kind) {
    case "ALL":
      return {};
    case "BRANCH":
      return { branchId: branchIn(s.branchIds) };
    case "OWN":
      return { doerId: s.userId };
  }
}

export function quotationScopeWhere(s: Scope): Prisma.QuotationWhereInput {
  switch (s.kind) {
    case "ALL":
      return {};
    case "BRANCH":
      return { branchId: branchIn(s.branchIds) };
    case "OWN":
      return { createdById: s.userId };
  }
}
