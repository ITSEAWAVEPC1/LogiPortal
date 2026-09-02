import type { Role } from "./roles";

// Screen-level access per docs/platform-development-plan.md Section 4.2.
// Stage 0 only needs *visibility* (can this role see the nav item at all);
// the finer per-screen edit/view/approve distinctions from Section 4.2 get
// enforced inside each screen once it's built (Stage 1+).
export type ScreenKey =
  | "dashboard"
  | "enquiries"
  | "quotations"
  | "jobs"
  | "customers"
  | "documents"
  | "reports"
  | "accounts"
  | "dataImport"
  | "settings";

export const NAV_ITEMS: {
  key: ScreenKey;
  label: string;
  href: string;
  builtInStage: number;
  // Optional sub-links rendered as an expandable group. Children point at the
  // same screen with a query param (not a new route) so screen-access checks,
  // page guards and existing links are untouched.
  children?: { label: string; href: string }[];
}[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", builtInStage: 10 },
  { key: "enquiries", label: "Enquiries", href: "/enquiries", builtInStage: 2 },
  { key: "quotations", label: "Quotations", href: "/quotations", builtInStage: 3 },
  {
    key: "jobs",
    label: "Freight Forwarding",
    href: "/jobs",
    builtInStage: 4,
    children: [
      { label: "Imports", href: "/jobs?shipmentType=IMPORT" },
      { label: "Exports", href: "/jobs?shipmentType=EXPORT" },
    ],
  },
  { key: "customers", label: "Customers", href: "/customers", builtInStage: 1 },
  { key: "documents", label: "Documents", href: "/documents", builtInStage: 7 },
  { key: "reports", label: "Reports", href: "/reports", builtInStage: 10 },
  { key: "accounts", label: "Accounts", href: "/accounts", builtInStage: 4 },
  { key: "dataImport", label: "Data Import", href: "/data-import", builtInStage: 1 },
  { key: "settings", label: "Settings", href: "/settings", builtInStage: 1 },
];

// NOTE: Section 2.2 lists "Accounts" as a sidebar nav item, but Section 4.2's
// screen-access matrix has no row for it. Defaulted here to Admin, Branch
// Manager, and Accounts/Finance (the roles that own financial screens
// elsewhere in the matrix) — flagged in docs/stage-checklists/stage-0.md as
// an assumption to confirm.
const SCREEN_ACCESS: Record<Role, ScreenKey[]> = {
  ADMIN: [
    "dashboard",
    "enquiries",
    "quotations",
    "jobs",
    "customers",
    "documents",
    "reports",
    "accounts",
    "dataImport",
    "settings",
  ],
  BRANCH_MANAGER: [
    "dashboard",
    "enquiries",
    "quotations",
    "jobs",
    "customers",
    "documents",
    "reports",
    "accounts",
    "settings",
  ],
  DOER: ["dashboard", "enquiries", "quotations", "jobs", "customers", "documents"],
  SALES: ["dashboard", "customers", "enquiries", "quotations", "jobs", "documents", "reports"],
  ACCOUNTS: [
    "dashboard",
    "customers",
    "enquiries",
    "quotations",
    "jobs",
    "documents",
    "reports",
    "accounts",
  ],
  // Stage 9 — CUSTOMER users never render the internal dashboard shell (the
  // (dashboard) layout redirects them to /portal); their navigation lives in
  // the (portal) route group's own PortalNav.
  CUSTOMER: [],
};

export function getVisibleNavItems(role: Role) {
  const allowed = new Set(SCREEN_ACCESS[role]);
  return NAV_ITEMS.filter((item) => allowed.has(item.key));
}

export function canAccessScreen(role: Role, screen: ScreenKey): boolean {
  return SCREEN_ACCESS[role].includes(screen);
}
