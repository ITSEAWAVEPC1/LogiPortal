// Canonical Role type, kept as a plain string union (not imported from the
// generated Prisma client) so it stays safe to use in edge middleware, where
// the Prisma client cannot run. Values must match the `Role` enum in
// prisma/schema.prisma exactly.
export const ROLES = [
  "ADMIN",
  "BRANCH_MANAGER",
  "DOER",
  "SALES",
  "ACCOUNTS",
  "CUSTOMER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BRANCH_MANAGER: "Branch Manager",
  DOER: "Doer / Ops Executive",
  SALES: "Sales / Enquiry",
  ACCOUNTS: "Accounts / Finance",
  CUSTOMER: "Customer",
};
