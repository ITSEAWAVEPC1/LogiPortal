import type { Role } from "./roles";

// Per-action capability (create/edit/view/delete), distinct from
// access-matrix.ts's boolean sidebar visibility. Encodes Section 4.2's
// per-role capability exactly. Fixed policy, not admin-configurable data —
// unlike FieldPermission (field-permissions.ts), which is deliberately
// DB-backed because Section 4.3 implies it may need tuning later.
export type Action = "view" | "create" | "edit" | "delete";
export type CapabilityScreen = "customers" | "branches" | "users" | "dataImport";

const CAPABILITIES: Record<Role, Partial<Record<CapabilityScreen, Action[]>>> = {
  ADMIN: {
    customers: ["view", "create", "edit", "delete"],
    branches: ["view", "create", "edit", "delete"],
    users: ["view", "create", "edit", "delete"],
    dataImport: ["view", "create"],
  },
  BRANCH_MANAGER: {
    customers: ["view", "edit"],
    branches: ["view"],
  },
  DOER: {
    customers: ["view", "create"],
  },
  SALES: {
    customers: ["view", "create", "edit"],
  },
  ACCOUNTS: {
    customers: ["view"],
  },
  // "Own org only" (Customer's real Section 4.2 right) needs User.organizationId,
  // which doesn't exist until Stage 9 — see docs/stage-checklists/stage-1.md.
  CUSTOMER: {},
};

export function can(role: Role, screen: CapabilityScreen, action: Action): boolean {
  return CAPABILITIES[role]?.[screen]?.includes(action) ?? false;
}

export function capabilitiesFor(role: Role, screen: CapabilityScreen): Action[] {
  return CAPABILITIES[role]?.[screen] ?? [];
}
