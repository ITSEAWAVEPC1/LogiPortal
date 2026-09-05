# Stage 13b — `DataTable` + shadcn `Table` Mobile Card Rendering (+ Two Drive-by Fixes)

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Playwright-driven
browser verification (every `DataTable` screen, dashboard Recent Jobs, a populated report,
desktop breakpoint) all passed, no console errors. Second of four Stage 13 (Mobile Web
Compatibility) sub-stages. Committed on branch `stage-13b-table-cards` (off
`stage-13a-appshell-drawer`); **not pushed**.

## What was built

### `DataTable` — additive `Column<T>` fields, dual-render
`src/components/ui/DataTable.tsx` gained two optional `Column<T>` fields:
`isRowTitle?: boolean` and `mobileHidden?: boolean`. With **zero call-site changes**: the
first column in the array is the mobile card's title unless another column sets
`isRowTitle: true`; every other column (except `mobileHidden: true` ones) becomes a
`label: value` row using the exact same `col.render?.(row) ?? row[col.key]` logic the
desktop `<td>` already used (extracted into a shared `cellValue()` helper). Renders both
trees — `hidden lg:block` desktop `<table>` (byte-identical to before), `lg:hidden` mobile
card list — from the same `columns`/`data`, no refetch.

### New `src/components/ui/MobileRowCard.tsx`
Plain presentational component (`{ title, rows: {label, value}[], emphasized? }`) — a
bordered card with a heading + label/value rows. Added to the `src/components/ui/index.ts`
barrel. Reused by `DataTable`, `RecentJobsTable`, and `ReportTable` (below) rather than each
hand-rolling its own card markup.

### `RecentJobsTable` and `ReportTable` — hand-split, not rebuilt on `DataTable`
Both wrap their existing shadcn `<Table>` in `hidden lg:block` and add an `lg:hidden`
`MobileRowCard` list using their own existing formatting helpers (`statusClasses`/`money`/
`shortDate` for jobs; `formatReportCell` for reports — `ReportTable`'s optional `total` row
becomes one trailing `emphasized` card). Not refactored onto `DataTable`/`Column<T>` — only
2 call sites, and doing so would lose Badge/tabular-nums/footer-specific styling for no
benefit.

### Per-call-site audit — no tweaks needed
Checked all 13 real `DataTable` consumers (`CustomerDirectory`, `JobList`, `QuotationList`,
`EnquiryList`, `UserManager`, `BranchManager`, `BillTypeManager`, `DocumentTypeManager`,
`PortManager`, `BatchHistoryTable`, `ImportWizard`, `DocumentsBrowser`, `DocumentsPanel`).
Every one already has a well-suited first column (Reference, Name, File, Row, Title) — the
default title-column behavior is correct everywhere; **no `isRowTitle`/`mobileHidden`
overrides were needed anywhere.** `CustomerDirectory`'s columns are user-configurable via
`ColumnPicker` (order can be rearranged/saved per `UserColumnPreference`) — left as-is
deliberately: whatever column a user has placed first is what they've chosen to see first,
which is a reasonable mobile card title too.

## Two issues found during verification and fixed (user-approved mid-stage)

Both surfaced by the Playwright browser pass below and were confirmed with the user before
fixing, since neither was in the original Stage 13 plan's file list.

### 1. Date-locale hydration mismatch (pre-existing bug, doubled by the dual-render)
`JobList.tsx`, `QuotationList.tsx`, `EnquiryList.tsx`, `BatchHistoryTable.tsx`, and
`DocumentsBrowser.tsx` all had a `DataTable` column calling `new Date(x).toLocaleDateString()`
/`.toLocaleString()` with **no explicit locale** — this resolves to the runtime's default
locale, which differs between the Node SSR process and the browser, causing a React
hydration-mismatch warning (harmless — React just regenerates the subtree — but noisy).
**Pre-existing, unrelated to Stage 13, confirmed via `git log` that these lines predate this
work** — but 13b's dual-render (table + card, both calling the same `render` function) now
triggers it twice per page instead of once, which is what surfaced it in the verification
pass. Fixed by adding an explicit locale (`"en-GB"`), matching the pattern the app's own
`shortDate()` helper (`src/components/portal/portal-format.ts`) already uses safely. Scoped
to exactly the 5 files whose date formatting sits inside a `DataTable` column (i.e. the ones
this stage's change actually doubles) — the ~10 other bare `toLocaleString()`/
`toLocaleDateString()` call sites found elsewhere (PDF generation, `DocumentHtmlPreview`,
`QuotationHtmlPreview`, `AuditTrail`, `StepDetailCard`, `QuotationDetail`) are **not** inside
a `DataTable`, carry the same risk profile as before this stage, and were left untouched as
out of scope.

### 2. List/manager page headers didn't stack on mobile (systemic, 13 files)
Every list/manager screen's header row (`<h1>Title</h1>` + action button(s)) used
`flex items-center justify-between` with no responsive fallback — at 375px this squeezed
the heading and button(s) together, visibly colliding (worst on `JobList.tsx`: "Freight
Forwarding" + "Import Historical Jobs" + "New Job" all fighting for one row). Same pattern
found via `grep` in 13 files. Fixed uniformly: `flex items-center justify-between` →
`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between` (stacks title above
buttons below `lg`, restores the original row layout at `lg`+ — same breakpoint as
everything else in Stage 13), plus `flex-wrap` added to the two button groups that hold more
than one button (`CustomerDirectory`, `OrganizationEditor`, `JobList`) as a safety net.
Files: `CustomerDirectory.tsx`, `OrganizationEditor.tsx`, `QuotationList.tsx`,
`DocumentTypeManager.tsx`, `UserManager.tsx`, `BillTypeManager.tsx`, `BranchManager.tsx`,
`PortManager.tsx`, `EnquiryList.tsx`, `EnquiryForm.tsx`, `jobs/import/page.tsx`,
`JobForm.tsx`, `JobList.tsx`.

## Files touched

- **New**: `src/components/ui/MobileRowCard.tsx`
- **Modified (planned)**: `src/components/ui/DataTable.tsx`, `src/components/ui/index.ts`,
  `src/components/dashboard/RecentJobsTable.tsx`, `src/components/reports/ReportTable.tsx`
- **Modified (date-locale fix)**: `src/app/(dashboard)/jobs/_components/JobList.tsx`,
  `src/app/(dashboard)/quotations/_components/QuotationList.tsx`,
  `src/app/(dashboard)/enquiries/_components/EnquiryList.tsx`,
  `src/app/(dashboard)/data-import/_components/BatchHistoryTable.tsx`,
  `src/app/(dashboard)/documents/_components/DocumentsBrowser.tsx`
- **Modified (header-stacking fix)**: the 13 files listed above (`JobList.tsx`,
  `QuotationList.tsx`, `EnquiryList.tsx` overlap with the date-locale fix list; the rest are
  `CustomerDirectory.tsx`, `OrganizationEditor.tsx`, `DocumentTypeManager.tsx`,
  `UserManager.tsx`, `BillTypeManager.tsx`, `BranchManager.tsx`, `PortManager.tsx`,
  `EnquiryForm.tsx`, `jobs/import/page.tsx`, `JobForm.tsx`)

## DB models added

None — pure UI/CSS.

## Endpoints added/changed

None.

## Permissions

None.

## Key decisions

1. **`isRowTitle`/`mobileHidden` as the only new `Column<T>` fields** — additive-only,
   defaults (first column = title) correct at every real call site, no third field
   (e.g. a `mobileLabel` override) needed.
2. **`RecentJobsTable`/`ReportTable` hand-split rather than migrated onto `DataTable`** — only
   2 call sites each with bespoke footer/Badge/tabular-nums styling; migrating would have
   lost that for no reuse benefit beyond the shared `MobileRowCard` primitive, which they
   already get.
3. **Date-locale fix scoped to `DataTable`-column call sites only** — the other ~10 bare
   `toLocaleString()` sites elsewhere in the app are a pre-existing, separate-risk-profile
   issue not amplified by this stage; fixing them is out of scope here.
4. **Header-stacking fix uses the same `lg` (1024px) breakpoint as the rest of Stage 13**,
   not a lighter `sm`/`md` — deliberately, to keep exactly one fork point across the whole
   mobile-compatibility effort even though a header row alone would look fine side-by-side
   well before 1024px on a tablet.

## Explicitly deferred

- The ~10 non-`DataTable` `toLocaleString()`/`toLocaleDateString()` call sites (PDF
  generation, HTML previews, audit trail, quotation detail) — same latent hydration-mismatch
  risk as always, not amplified by Stage 13, left for a separate pass if it ever surfaces.
- `design-system/page.tsx`'s demo `DataTable` — left untouched; it now demos card mode too
  for free, no action needed.

## Verification

Playwright (installed with `npm install --no-save playwright` for this verification pass
only, using the Chromium binary already cached from 13a's run, then fully uninstalled
afterward) drove a headless Chromium against the running dev server, logged in as
`admin@test.seawave.com`, and at 375×667 confirmed, for `/customers`, `/jobs`, `/quotations`,
`/enquiries`, `/settings/users`, `/dashboard` (Recent Jobs), and `/reports/branch-performance`:
table hidden, card list shown and populated (card counts matched row counts), no horizontal
overflow (`scrollWidth === clientWidth`). At 1280×800, `/customers` reverted to the real
table with cards hidden. Zero console/page errors (confirmed both before and after the two
drive-by fixes — the date-locale fix specifically eliminated the hydration-mismatch warnings
that the first pass surfaced). A manual screenshot of `/jobs` at 375×667 confirmed the header
fix visually: title and buttons now stack cleanly instead of colliding.

`tsc --noEmit`, `eslint src`, `next build` all clean (all 59 routes compiled).

## Failover

Pure additive UI/CSS, no data/schema involved. Revert = drop branch
`stage-13b-table-cards`. No cleanup needed — verification touched no application data, and
the temporary Playwright package was uninstalled after use both times.
