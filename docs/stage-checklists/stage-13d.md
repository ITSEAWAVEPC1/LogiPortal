# Stage 13d — Portal Shell Migration + Portal-Specific Mobile Pass

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Playwright-driven
browser verification, logged in as `customer@test.seawave.com`, confirmed the drawer, nav,
active-link state, `NotificationBell` singularity, and both refactored tables at 375px and
1280px — no console errors. Fourth and final Stage 13 (Mobile Web Compatibility) sub-stage.
Committed on branch `stage-13d-portal-mobile` (off `stage-13c-forms-sweep`); **not pushed**.

## What was built

### Portal switched onto the shared `AppShell` (built in 13a)
`src/app/(portal)/layout.tsx` no longer hand-duplicates sidebar markup — it now renders
`<AppShell navItems={PORTAL_NAV_ITEMS} sidebarFooter={...}>`, passing the existing
user-name/"Customer portal" label/`NotificationBell`/`PortalSignOut` block through
`sidebarFooter` (content unchanged, just relocated) and a new `<PortalMobileHeader/>` before
`<main>`. The portal gets the exact same off-canvas hamburger drawer as the dashboard, below
`lg`, for free.

### New `src/lib/portal/nav-items.ts`
`PORTAL_NAV_ITEMS`, moved verbatim from the old `PortalNav.tsx`'s hardcoded `ITEMS` array,
typed as `AppShellNavItem[]`. Deliberately **not** sourced from `access-matrix.ts` — the
portal's nav data source stays separate (customers get `[]` in `SCREEN_ACCESS` there since
they never reach the dashboard shell); only the drawer/hamburger/overlay **mechanics** are
shared, not the nav's data.

### New `src/components/portal/PortalMobileHeader.tsx`
The portal never had a Topbar (no search/branch-select — dashboard-only concepts), so unlike
the dashboard it needed a small header of its own purely to host the hamburger trigger below
`lg`: `Menu` icon + brand mark, `lg:hidden`. `"use client"` and kept tiny, mirroring
`PortalSignOut`'s existing pattern of being its own small client component so the layout
itself stays an async Server Component.

### `src/components/portal/PortalNav.tsx` — deleted
Superseded by `AppShell`'s internal nav renderer, which reproduces (and, per the bug fix
below, improves on) its active-link logic. Confirmed via grep it had no other importers.

### Bug found and fixed: `AppShell`'s active-link logic (in the 13a-authored file)
Building the portal onto `AppShell` exposed a latent correctness gap: the per-item check
`pathname === item.href || pathname.startsWith(`${item.href}/`)` marks an item active
independently of its siblings. The dashboard's `NAV_ITEMS` hrefs are all disjoint (no href is
a prefix of another), so this never mattered there — but the portal's `{ href: "/portal",
label: "Dashboard" }` **is** a literal path-prefix of every other portal route
(`/portal/jobs`, `/portal/quotations`, ...), so visiting `/portal/jobs` would have marked
**both** "Dashboard" and "Jobs" active simultaneously. Fixed by computing one **longest-prefix
match** across all top-level hrefs per render, then marking only that single href's item
active — a no-op for the dashboard shell (verified: still correct there) and correct for the
portal (verified: `/portal/jobs` → only "Jobs" active; `/portal` → only "Dashboard" active).

### Portal's third table system consolidated onto `DataTable`
`src/app/(portal)/portal/jobs/page.tsx` and `.../portal/quotations/page.tsx` each hand-rolled
their own plain `<table>` — a third, separate implementation from the dashboard's `DataTable`
and the shadcn `Table` used by Recent Jobs/Reports, with no mobile treatment at all. Both
refactored onto `DataTable` (reusing the already-exported `PortalJobListRow`/
`PortalQuotationListRow` types from `src/lib/portal/queries.ts` rather than hand-typing new
interfaces), which is a plain function component (fully server-renderable) and gets 13b's
card-mode for free — no new mobile-specific code needed here at all. Net effect: the app now
has 2 table implementations instead of 3.

### `NotificationBell` — stays singular
Deliberately kept **only** in `sidebarFooter` (visible in the drawer on mobile, in the static
sidebar at desktop) — not duplicated into `PortalMobileHeader`. Verified: exactly one bell
button exists in the DOM at both 375px and 1280px.

### Portal content grids — left as-is
`portal/page.tsx`, `portal/profile/page.tsx`, `PortalJobView.tsx` already use working
three-tier responsive grids (`sm:`/`lg:`) from before this stage. Not touched — re-verified
only that nothing regressed after the shell swap (no double sidebars, no missing padding;
confirmed via the dashboard screenshot below).

## Files touched

- **New**: `src/lib/portal/nav-items.ts`, `src/components/portal/PortalMobileHeader.tsx`
- **Modified**: `src/app/(portal)/layout.tsx`, `src/app/(portal)/portal/jobs/page.tsx`,
  `src/app/(portal)/portal/quotations/page.tsx`, `src/components/layout/AppShell.tsx`
- **Deleted**: `src/components/portal/PortalNav.tsx`

## DB models added

None — pure UI/CSS.

## Endpoints added/changed

None. `getPortalJobs`/`getPortalQuotations` (`src/lib/portal/queries.ts`) untouched — only
their already-exported return-type names are now imported by the two page components instead
of being re-declared.

## Permissions

None. `access-matrix.ts`, `capabilities.ts`, `field-permissions.ts` all untouched — the
portal's nav data source is deliberately kept separate from `NAV_ITEMS`/`SCREEN_ACCESS`, per
the plan's decision #4 (share rendering mechanics, not the data source).

## Key decisions

1. **`AppShell`'s active-link fix applied directly to the 13a file**, not worked around in the
   portal — the bug is generic (any nav tree with a root/prefix relationship would hit it),
   so fixing it once in the shared component is more correct than a portal-local patch, and
   it's verified to be a no-op for the dashboard's existing behavior.
2. **Portal nav data stays separate from `access-matrix.ts`** — reuse is scoped to shell
   mechanics only, keeping the app's three deliberately-separate permission mechanisms intact
   (this was decision #4 from the approved Stage 13 plan, reconfirmed here).
3. **Portal's two list pages migrated onto `DataTable`** rather than hand-building a third
   mobile-card implementation — reduces the app to 2 table systems, gets mobile card-mode for
   free, and reuses already-exported row types instead of new ad-hoc interfaces.
4. **`NotificationBell` kept singular in `sidebarFooter`**, not added to
   `PortalMobileHeader` — avoids a mobile-only duplicate and a desktop-only disappearance.

## Explicitly deferred

Nothing new for this sub-stage — this closes out the plan's four-sub-stage scope for Stage 13.

## Verification

Playwright (installed with `npm install --no-save playwright` for this pass only, using the
cached Chromium binary, uninstalled afterward) drove a headless Chromium against the running
dev server, logged in as `customer@test.seawave.com` (already linked to an Organization with
seeded shipments/quotations, confirmed by real data rendering rather than the "not linked"
fallback):

- At 375×667: hamburger visible, sidebar off-screen, no horizontal overflow; opening the
  drawer shows the correct 5-item nav (Dashboard, Jobs, Quotations, Documents, Profile) with
  the bell and "Sign out" in the footer, exactly one bell button in the whole DOM; clicking
  "Jobs" navigates to `/portal/jobs` **and** closes the drawer; both `/portal/jobs` and
  `/portal/quotations` render as card lists (table hidden, cards shown) with correct data.
- At 1280×800: sidebar permanently visible, hamburger hidden, still exactly one bell button —
  screenshotted and confirmed pixel-equivalent to the pre-Stage-13 portal dashboard layout.
- **Active-link fix specifically verified**: on `/portal/jobs`, "Dashboard" is *not* marked
  active and "Jobs" *is*; on `/portal`, "Dashboard" *is* marked active — confirming the
  longest-prefix-match fix resolved the `/portal` vs `/portal/jobs` ambiguity correctly.
- Zero console/page errors throughout.

`tsc --noEmit`, `eslint src`, `next build` all clean (all 59 routes compiled).

## Failover

Pure additive UI/CSS, no data/schema involved. Revert = drop branch
`stage-13d-portal-mobile`. No cleanup needed — verification touched no application data
(read-only portal browsing as a seeded test user), and the temporary Playwright package was
uninstalled after use.

---

## Stage 13 — done

All four sub-stages (13a shared AppShell + hamburger drawer + Modal mobile mode · 13b
DataTable/shadcn Table mobile cards · 13c form/grid responsiveness sweep · 13d portal shell
migration) are complete, each on its own branch with its own checklist, none pushed. The
platform now has one consistent mobile breakpoint (`lg`, 1024px) applied across navigation,
tables, forms, and the workflow step tracker, for both the internal dashboard and the
customer portal.
