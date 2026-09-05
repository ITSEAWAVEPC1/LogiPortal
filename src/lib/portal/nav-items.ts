import type { AppShellNavItem } from "@/components/layout/AppShell";

// Moved from the old PortalNav.tsx verbatim — the portal's nav is
// deliberately NOT sourced from access-matrix.ts's NAV_ITEMS/SCREEN_ACCESS
// (CUSTOMER gets [] there since customers never reach the (dashboard) shell).
// AppShell is reused for its drawer/hamburger/overlay *mechanics* only.
export const PORTAL_NAV_ITEMS: AppShellNavItem[] = [
  { key: "portal-dashboard", label: "Dashboard", href: "/portal" },
  { key: "portal-jobs", label: "Jobs", href: "/portal/jobs" },
  { key: "portal-quotations", label: "Quotations", href: "/portal/quotations" },
  { key: "portal-documents", label: "Documents", href: "/portal/documents" },
  { key: "portal-profile", label: "Profile", href: "/portal/profile" },
];
