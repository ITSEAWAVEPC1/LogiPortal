import type { Role } from "./roles";

// Per-action capability (create/edit/view/delete), distinct from
// access-matrix.ts's boolean sidebar visibility. Encodes Section 4.2's
// per-role capability exactly. Fixed policy, not admin-configurable data —
// unlike FieldPermission (field-permissions.ts), which is deliberately
// DB-backed because Section 4.3 implies it may need tuning later.
// "approve" added in Stage 2 for the Branch Manager's Enquiry review gate —
// Section 4.2 shows the same Edit/Approve split recurring for Quotations
// (Stage 3) and Documents later, so it's established here on its first real
// use rather than retrofitted across three screens at once.
export type Action = "view" | "create" | "edit" | "delete" | "approve";
export type CapabilityScreen =
  | "customers"
  | "branches"
  | "users"
  | "dataImport"
  | "enquiries"
  | "billTypes"
  | "quotations"
  | "jobs";

const CAPABILITIES: Record<Role, Partial<Record<CapabilityScreen, Action[]>>> = {
  ADMIN: {
    customers: ["view", "create", "edit", "delete"],
    branches: ["view", "create", "edit", "delete"],
    users: ["view", "create", "edit", "delete"],
    dataImport: ["view", "create"],
    enquiries: ["view", "create", "edit", "approve"],
    // Admin-configurable Billing master (Customer Master v2) — new Bill
    // Types can be added without a deploy, per the acceptance criteria.
    billTypes: ["view", "create", "edit", "delete"],
    quotations: ["view", "create", "edit", "approve"],
    jobs: ["view", "create", "edit", "approve"],
  },
  BRANCH_MANAGER: {
    customers: ["view", "edit"],
    branches: ["view"],
    enquiries: ["view", "edit", "approve"],
    quotations: ["view", "edit", "approve"],
    // Section 4.2 "Jobs" row: Edit/Override + the final-review approval gate.
    jobs: ["view", "edit", "approve"],
  },
  DOER: {
    customers: ["view", "create"],
    enquiries: ["view", "create", "edit"],
    quotations: ["view"],
    // Section 4.2: "Create/Edit workflow steps" — the Doer owns Job creation
    // and completion; the workflow-step engine itself lands in Stage 5.
    jobs: ["view", "create", "edit"],
  },
  SALES: {
    customers: ["view", "create", "edit"],
    enquiries: ["view", "create", "edit"],
    quotations: ["view", "create", "edit"],
    jobs: ["view"],
  },
  ACCOUNTS: {
    customers: ["view"],
    enquiries: ["view"],
    // Section 4.2: "View charges" — no field-level nuance matrix exists for
    // Quotations the way Section 4.3 defines one for Jobs, so plain
    // view-only at the whole-quotation level is the correct-scope default.
    quotations: ["view"],
    // Section 4.2: "View + edit billing sections". Whole-screen "edit" is
    // granted so Accounts can reach the Job at all; the Section 4.3
    // field-group gate (field-permissions.ts, resource "job") then confines
    // their writes to charges / dutyPayment / documents — same "either
    // whole-resource edit OR any section field-group EDIT" pattern as
    // Customer Master v2 decision #3.
    jobs: ["view", "edit"],
  },
  // "Own org only" / "Own quotations, view only" (Customer's real Section 4.2
  // right) needs User.organizationId, which doesn't exist until Stage 9 —
  // see docs/stage-checklists/stage-1.md. No "enquiries"/"quotations" key at
  // all here for Enquiries (No access); Quotations deferred the same way.
  CUSTOMER: {},
};

export function can(role: Role, screen: CapabilityScreen, action: Action): boolean {
  return CAPABILITIES[role]?.[screen]?.includes(action) ?? false;
}

export function capabilitiesFor(role: Role, screen: CapabilityScreen): Action[] {
  return CAPABILITIES[role]?.[screen] ?? [];
}
