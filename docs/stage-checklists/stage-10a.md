# Stage 10a — shadcn/ui Foundation + New `/dashboard`

Status: **Complete.** `tsc --noEmit`, `eslint src`, `prisma generate` all clean;
`next build` clean; per-role HTTP verification (21 checks) all passed against the running
dev server. First of four Stage 10 sub-stages (10a → 10d). Committed on branch
`stage-10a-shadcn-dashboard`; **not pushed** (push is a separate explicit request).

## What was built

### shadcn/ui stack — additive, coexists with the existing 13 primitives
- **New deps**: `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react` (v1),
  `next-themes`, `sonner`, `recharts@^3` (React-19-native), `radix-ui` (the consolidated
  package — every generated component imports from it, so the individual `@radix-ui/*`
  packages were installed then removed).
- **`src/lib/utils/cn.ts`** upgraded from a hand-rolled clsx-style join to
  `twMerge(clsx(...))`. `clsx`'s `ClassValue` covers the same input shapes, so all 13
  existing `src/components/ui/` primitives compile and render unchanged. `twMerge` only
  changes output for *conflicting* Tailwind utilities ("last wins") — the intended shadcn
  behaviour. Grep confirmed every existing component passes an explicit
  `border border-border-subtle` (never a bare `border` relying on `currentColor`), so the
  new base-layer default border colour is a no-op for them.
- **`components.json`** at repo root: `style: "new-york"`, `rsc: true`, Tailwind v4
  (`tailwind.config: ""`, `css: "src/app/globals.css"`), `iconLibrary: "lucide"`,
  `aliases.ui`/`components` → `@/components/shadcn`, `aliases.utils` → `@/lib/utils/cn`.
- **`src/components/shadcn/`** (16 primitives, CLI-generated, **Tailwind-v4 style** — no
  `hsl()` wrappers, no config file): `button`, `card`, `badge`, `table`, `tabs`,
  `dropdown-menu`, `dialog`, `input`, `label`, `select`, `separator`, `skeleton`, `sonner`,
  `chart`, `popover`, `tooltip`. Untouched afterward. **The parallel directory is
  mandatory** — this FS is case-insensitive, so `button.tsx` cannot share a folder with the
  existing `Button.tsx`. `src/components/ui/index.ts` and every existing primitive are
  byte-for-byte unchanged.

### Token layer — `src/styles/shadcn-tokens.css` (new)
`@import`ed from `globals.css` right after `tokens.css`. Maps shadcn's conventional names
onto the brand palette (§2.1): `--primary → --brand-teal`, `--secondary → --brand-plum`,
`--card`/`--popover → --surface-white`, `--border`/`--input → --border-subtle`,
`--ring → --brand-teal`, `--muted → --bg-offwhite`, `--destructive → --status-danger-fg`,
`--radius: 0.5rem`, `--chart-1..5` (teal, plum, + three supporting hues). `globals.css`
`@theme inline` registers the matching `--color-*` / `--radius-*` utilities. A `.dark { … }`
block + `@media (prefers-color-scheme: dark)` mirror are present but **inert** — see below.
`globals.css` `body` font fixed from hard-coded `Arial` to `var(--font-geist-sans), …`
(it already mapped Geist via `@theme` but never used it).

### Theming — light only
- **`src/components/providers/ThemeProvider.tsx`** (`"use client"`) wraps `next-themes`
  with `attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}
  disableTransitionOnChange`. Mounted in `src/app/layout.tsx` around `{children}`;
  `suppressHydrationWarning` added to `<html>`. `forcedTheme` pins `class="light"` on
  `<html>`, so none of the `.dark` token blocks can activate. No toggle UI. Dark mode is
  now a one-line change (drop `forcedTheme`, add a toggle) with zero component edits.
- **`<Toaster />`** (sonner) mounted in `src/app/(dashboard)/layout.tsx`.

### `src/lib/permissions/scope.ts` (new) — the fourth permission mechanism
Row-scoping for aggregate views, deliberately **separate** from access-matrix (nav),
capabilities (per-action), and field-permissions (per-field-group). §4.2 scopes Dashboard
and Reports *differently*, so two entry points:
- `dashboardScope(user)` — ADMIN → `ALL`; every other internal role → `BRANCH` (own
  branch); CUSTOMER throws (never reaches the dashboard).
- `reportScope(user)` / `assertReportAccess(role)` — ADMIN & ACCOUNTS → `ALL`;
  BRANCH_MANAGER → `BRANCH`; SALES → `OWN`; DOER/CUSTOMER throw. (Used from 10b onward.)
- `Scope = { kind: "ALL" } | { kind: "BRANCH"; branchIds } | { kind: "OWN"; userId }`.
- `jobScopeWhere` / `enquiryScopeWhere` / `quotationScopeWhere` → Prisma `where` fragments.
  A `BRANCH` scope with no branch ids (a manager whose `User.branchId` is null — untested;
  every seed user is on Mumbai) resolves to `{ in: [NO_BRANCH] }` = matches nothing
  (fail-closed, same stance as `portal/guard.ts`'s `NO_ORG`).

### New `/dashboard` (replaces the `StagePlaceholder` stub)
- `src/app/(dashboard)/dashboard/page.tsx` — server component: `auth()` →
  `canAccessScreen(role, "dashboard")` else `redirect("/")` → `dashboardScope(session.user)`.
- **`src/lib/dashboard/queries.ts`** (new, server-only, mirrors `portal/queries.ts`):
  `getDashboardStats` (parallel `count` + `aggregate`), `getRevenueByMonth` (last 6 months
  of `Job.quotedTotal` bucketed by `createdAt` in JS — pre-seeded so empty months render
  0), `getRecentJobs` (8 most-recently-updated). All filtered through the `Scope`.
- **`src/components/dashboard/`** (new): `StatCard` (server — shadcn `Card`, teal/plum
  accent per §2.1), `RevenueBarChart` (`"use client"` — recharts `BarChart` inside the
  shadcn `ChartContainer`), `RecentJobsTable` (server — shadcn `Table` + `Badge`, links to
  `/jobs/[id]`, brand status-colour map).
- Stat cards: Total jobs · Ongoing (`WORKFLOW_IN_PROGRESS`) · Pending review
  (`PENDING_REVIEW`) · Revenue (scoped `SUM(quotedTotal)`, formatted INR). Scope label
  ("All branches" / "<branch> branch") under the title.
- **On-time donut and the CXO KPI band are 10b** (they need `Job.expected/actualDeliveryDate`).
- With the current seed there is no transactional data, so every figure is 0 / the chart is
  empty — expected; `prisma/seed-demo.ts` lands in 10b.

### Topbar (`src/components/layout/Topbar.tsx`)
- The plain name/role/"Sign out" cluster → a shadcn `DropdownMenu` (label with name+role,
  "Notification preferences" → `/settings/notifications`, "Sign out" → `signOut()`).
- Dead "Notifications" text button → an icon button (`lucide` `Bell`) — still non-functional
  (the real bell is 10c).
- Branch `<select>` now renders **for ADMIN only** (it is still non-functional local state;
  hiding it from other roles removes a misleading control until a real global branch filter
  exists, which is out of Stage 10 scope). Dead search box left as-is per plan.

### `/settings/notifications` (new stub)
`src/app/(dashboard)/settings/notifications/page.tsx` — `auth()`-only gate (no capability
check, unlike the Admin-only `/settings/*` tiles), reachable by every internal role. A
"coming soon" placeholder so the Topbar dropdown link is not broken; **10c replaces the
body** with the real `NotificationPreference` form.

### `/design-system`
`src/app/design-system/page.tsx` — a new "shadcn/ui primitives (Stage 10a)" block appended
below the existing sections (buttons, badges, card, tabs, table). Every existing section
kept.

## DB models added

**None.** Stage 10a is pure additive UI + deps. No schema change, no migration.

## Endpoints added / changed

**None.**

## Permissions

- **`capabilities.ts`** — no change (no `dashboard` screen; `/dashboard` gates on
  `canAccessScreen` + `dashboardScope`, the `accounts`-screen precedent).
- **`access-matrix.ts`** — no change (`dashboard` already granted to all five internal
  roles; CUSTOMER `[]`).
- **`field-permissions.ts`** — no change.
- **New**: `src/lib/permissions/scope.ts` — a fourth, independent mechanism. Documented
  divergence: `dashboardScope` includes DOER (branch-scoped) while `reportScope` throws for
  DOER; SALES is branch-scoped on the dashboard but own-records-only on reports; ACCOUNTS is
  branch-scoped on the dashboard but full-financial on reports. Two functions, on purpose.

## Key decisions

1. **Two coexisting component systems.** `src/components/shadcn/*` is used only on the new
   `/dashboard` (and `/reports` in 10b). Existing screens keep `src/components/ui/*`
   untouched; convergence is a later, separate effort.
2. **`cn` upgraded, not forked.** A single `twMerge(clsx())` for both systems — verified
   safe for the existing primitives.
3. **Light-only, but wired for dark.** `forcedTheme="light"` + placeholder `.dark` tokens.
4. **Branch `<select>` shown to ADMIN only** — minor deviation from "leave as-is"; a dead
   control is worse for non-admins who would expect it to filter.
5. **`/settings/notifications` stub in 10a** — so the Topbar link isn't a 404 before 10c.

## Explicitly deferred (later Stage 10 sub-stages)

- **On-time vs delayed donut, CXO KPI band, "Download report" PDF** — 10b (need the
  delivery-date columns + `seed-demo`).
- **Reports screens + `reportScope` consumers** — 10b.
- **Functional notification bell + `/settings/notifications` real form** — 10c.
- **`prisma/seed-demo.ts`** (demo dataset so the dashboard/reports show real numbers) — 10b.
- **Global branch filter actually wired to queries** — out of Stage 10 scope; the Topbar
  branch `<select>` stays cosmetic.
- **Migrating existing screens to shadcn** — not in Stage 10.

## Verification

Throwaway `_tmp_verify_stage10a.mjs` (deleted, not committed) — per-role HTTP through the
NextAuth credentials flow against the running dev server. **21 checks, all passed:**

1. Anon `/dashboard` → redirect to `/login`.
2. ADMIN `/dashboard` → 200, renders stat cards + "Revenue by month" + "Recent jobs",
   scope label "All branches"; `/design-system` → 200 with the shadcn section;
   `/settings/notifications` → 200.
3. BRANCH_MANAGER `/dashboard` → 200, branch-scoped label (not "All branches").
4. DOER / SALES / ACCOUNTS `/dashboard` → 200 with stat cards; `/settings/notifications` → 200.
5. CUSTOMER `/dashboard` → redirect to `/portal` (unchanged layout guard).

Plus a smoke pass as ADMIN over `/jobs`, `/quotations`, `/enquiries`, `/customers`,
`/documents`, `/settings`, `/design-system`, `/dashboard` → all 200, **zero error/warning
lines in the dev log** (the `cn` → `twMerge` regression risk). `tsc --noEmit` +
`eslint src` + `npx prisma generate` + `npx next build` all clean. Dev server was restarted
after the dependency install (new-module resolution).

> A full pixel-level visual regression pass over the existing screens was not done here;
> HTTP + type + lint + build are green and the `cn` change is provably safe for the current
> primitives (all pass explicit border/colour classes).

## Failover

Pure additive UI + dependencies. No schema change, no data change, no endpoint change.
Revert = delete branch `stage-10a-shadcn-dashboard`. The `/dashboard` route falls back to
nothing (the old content was a `StagePlaceholder`); every other screen is untouched.
