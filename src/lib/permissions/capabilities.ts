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
export type CapabilityScreen = "customers" | "branches" | "users" | "dataImport" | "enquiries" | "billTypes";

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
  },
  BRANCH_MANAGER: {
    customers: ["view", "edit"],
    branches: ["view"],
    enquiries: ["view", "edit", "approve"],
  },
  DOER: {
    customers: ["view", "create"],
    enquiries: ["view", "create", "edit"],
  },
  SALES: {
    customers: ["view", "create", "edit"],
    enquiries: ["view", "create", "edit"],
  },
  ACCOUNTS: {
    customers: ["view"],
    enquiries: ["view"],
  },
  // "Own org only" (Customer's real Section 4.2 right) needs User.organizationId,
  // which doesn't exist until Stage 9 — see docs/stage-checklists/stage-1.md.
  // No "enquiries" key at all here — Section 4.2 says No access.
  CUSTOMER: {},
};

export function can(role: Role, screen: CapabilityScreen, action: Action): boolean {
  return CAPABILITIES[role]?.[screen]?.includes(action) ?? false;
}

export function capabilitiesFor(role: Role, screen: CapabilityScreen): Action[] {
  return CAPABILITIES[role]?.[screen] ?? [];
}
