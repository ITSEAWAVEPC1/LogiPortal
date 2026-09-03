# Stage 10b — Reports + CXO Dashboard KPIs

Status: **Complete.** `tsc --noEmit` + `eslint src prisma` + `next build` clean; 34-check
per-role HTTP verification + 8-check DB/logic verification all passed against the running
dev server with `prisma/seed-demo.ts` loaded (665 jobs / 615 quotations / 705 enquiries
across 7 branches, ~18 months). Second of four Stage 10 sub-stages. Committed on branch
`stage-10b-reports-cxo` (off `stage-10a-shadcn-dashboard`); **not pushed**.

## What was built

### Delivery SLA tracking (schema)
- **`Job.expectedDeliveryDate DateTime?`** + **`Job.actualDeliveryDate DateTime?`** +
  **`@@index([branchId, createdAt])`** — additive. Migration
  `prisma/migrations/20260903120000_stage_10b_delivery_dates/` (2× nullable `ADD COLUMN`,
  1× `CREATE INDEX`), applied via the Neon serverless-adapter + throwaway-`tsx` workaround
  (`[[prisma-migrate-neon-workaround]]`), then `prisma generate` + dev-server restart.
- Both fields belong to the **`workflowStatus`** field group
  (`JOB_FIELD_GROUP_KEYS.workflowStatus`, previously empty). Seed levels unchanged:
  EDIT for ADMIN/BM/DOER, VIEW for SALES/ACCOUNTS, no role NONE — so
  `redactJobForRole` never strips them.

### Delivery-date derivation
- **`src/lib/workflow/delivery-dates.ts`** (pure) — `DELIVERY_STEP_KEYS`
  (import: `eta_discharge_port` / `delivered_status`; export: `export_eta_to_pod` /
  `export_do_and_delivery`) + `deliveryDatePatchForStep({shipmentType, stepKey, stepData,
  isFinal, currentActualDeliveryDate})`. `expectedDeliveryDate` ← the ETA-at-POD step's
  `data.date`; `actualDeliveryDate` ← the delivery step's `data.date` (fallback `new Date()`),
  or — only when not already set — when the job's `isFinal` step completes (covers an export
  whose `export_do_and_delivery` was skipped; `export_bill_preparation` has no clean date).
- **Write-through** in `src/app/api/jobs/[id]/workflow/steps/[stepId]/route.ts`:
  `save` propagates `expectedDeliveryDate` only; `complete` (inside the existing
  `$transaction`) applies the full patch alongside the `isFinal` → `Job.status = COMPLETED`
  update. `shipmentType` + `actualDeliveryDate` added to the route's initial `job` select.
- **Manual edit** — `jobAutosaveSchema` gains `expectedDeliveryDate` / `actualDeliveryDate`
  (lenient date strings); `PATCH /api/jobs/[id]` applies them under a new
  `access.workflowStatus === "EDIT"` block. A PATCH carrying **only** delivery-date keys is
  allowed on a `WORKFLOW_IN_PROGRESS` / `COMPLETED` job too (the usual gate restricts
  non-admins to DRAFT / NEEDS_CORRECTION). `JobForm` gains a "Delivery" section with two
  `<input type="date">` fields, gated on `canGroup("workflowStatus")` /
  `groupDisabled("workflowStatus")`.
- **Backfill** — `prisma/backfill/20260903_delivery_dates.ts` (committed, idempotent, fills
  only NULLs, `ALLOW_BACKFILL=true` guard). Run once locally + once on deploy.

### Reports (`src/lib/reports/`)
- **`period.ts`** — `resolvePeriod("YTD"|"MTD"|"WTD"|"CUSTOM", from?, to?)` in Asia/Kolkata
  (UTC+5:30) half-open windows; `monthBuckets()` + `bucketKeyForDate()`.
- **`access.ts`** — `REPORT_KEYS` + `REPORT_META` + `canSeeReport(role, key)` /
  `visibleReports(role)`: branch-performance / pending-ageing / revenue → ADMIN,
  BRANCH_MANAGER, ACCOUNTS; conversion → + SALES.
- **`common.ts`** — `resolveReportBranchIds(scope, branchIdFilter)` (fail-closed to
  `NO_BRANCH` when a BM's URL param names a branch outside their scope), `branchWhere`,
  `listReportBranches`, `onTimeRate`, `pct`, `CHART_COLORS`.
- **`types.ts`** — `ReportFilters` (period + branch/org/serviceType), `ReportResult`
  (`table` + optional `extraTables` + `chart` + `note`), `ReportColumn` (`numeric` /
  `money`).
- Four runners `(scope, filters) => Promise<ReportResult>` via `index.ts` `runReport(key, …)`:
  - **`branch-performance.ts`** — per branch: jobs created, delivered (actualDeliveryDate in
    period), on-time % (jobs with both dates), revenue (`sum(quotedTotal)` for jobs created
    in period). Prisma `groupBy` + a `findMany` for the on-time split.
  - **`pending-ageing.ts`** — live snapshot (period ignored): open jobs, current stage via
    `currentActionableStep`, days-in-stage from that row's `updatedAt`, overdue =
    `expectedDeliveryDate < now && actualDeliveryDate == null`; chart = open jobs by stage.
  - **`revenue.ts`** — quoted (current quotation-version total, by `quotation.createdAt`) vs
    converted (`Job.quotedTotal` where `origin=QUOTATION`, by `job.createdAt`); primary
    table + chart by month; `extraTables` by branch / customer (top 15) / service type.
    Optional `organizationId` / `serviceType` filters. Not currency-converted (noted).
  - **`conversion.ts`** — Enquiries created → ready-for-quotation → quotations sent →
    customer-approved → converted (current status + downstream-record presence, since there
    is no status history — noted); win-rate by quotation month; chart = win-rate %.
- All scoped through **`reportScope`** (`src/lib/permissions/scope.ts`, added in 10a):
  ADMIN/ACCOUNTS = ALL, BRANCH_MANAGER = own branch, SALES = own records (`doerId` /
  `createdById`).

### Report UI
- `src/app/(dashboard)/reports/page.tsx` — landing, one shadcn `Card` link per
  `visibleReports(role)`; `redirect("/")` when none.
- **`src/app/(dashboard)/reports/[report]/page.tsx`** — **one dynamic route** for all four
  (deviates from the plan's four folders; DRYer, validated against `REPORT_KEYS`).
  `auth()` + `canAccessScreen(role,"reports")` + `canSeeReport` else redirect; reads
  `searchParams`; renders `<ReportView>`. ADMIN/ACCOUNTS (ALL scope) get a branch `<select>`;
  a BM has none.
- `src/components/reports/` — `ReportView` (server: `<form method="GET">` native filter
  controls + chart + primary table + extra tables + a plain `<a>` CSV link), `ReportChart`
  (`"use client"` — recharts bar/line in the shadcn `ChartContainer`), `ReportTable`
  (server, shadcn `Table` + footer totals), `report-format.ts` (`formatReportCell` — INR /
  count / string).
- **`GET /api/reports/[report]/export`** — `auth()` + `canSeeReport` (403 otherwise);
  re-runs the report under `reportScope`; serialises the primary + extra tables to CSV via
  `rowsToCsv`; `text/csv` + `Content-Disposition`.

### Dashboard additions
- **On-time donut** — `src/lib/dashboard/queries.ts` `getOnTimeStats(scope)`
  (on-time / delayed / no-target over all delivered jobs) + `OnTimeDonut.tsx` (`"use
  client"` recharts pie). Placed beside the revenue chart on `/dashboard`.
- **CXO KPI band** (ADMIN + BRANCH_MANAGER only) — `src/lib/dashboard/kpis.ts`
  `getCxoKpis(scope, period)` (jobs created, jobs delivered, on-time %, revenue) +
  `CxoKpiBand.tsx` (`"use client"` — YTD/MTD/WTD toggle + custom `<input type="date">`
  range; refetches `GET /api/dashboard/kpis` on change; "Download report" `<a>` to the PDF).
  The server page passes the initial YTD payload.
- **`GET /api/dashboard/kpis`** — `auth()` + role ∈ {ADMIN, BRANCH_MANAGER} (403 else);
  `dashboardScope`; JSON.
- **`GET /api/dashboard/report.pdf`** — same gate; `buildDashboardReportData(scope, period)`
  (`src/lib/pdf/dashboard/`, reuses `getCxoKpis` + `branchPerformanceReport` +
  `revenueReport`) → `renderDashboardReportWithRetry` (`src/lib/pdf/render-dashboard-report.tsx`,
  new sibling to `render-document-pdf.tsx`; 3-attempt retry + `dashboardPdfRenderer` test
  seam; `@react-pdf/renderer` `DashboardReportDocument.tsx`, brand-styled) → streams
  `application/pdf`. **Not** routed through `buildDocumentData` — the report is ephemeral,
  never persisted as a `Document`.

### Demo dataset
- **`prisma/seed-demo.ts`** + `npm run db:seed:demo` — committed, guarded
  (`ALLOW_DEMO_SEED=true`, never in production), deterministic PRNG, `--clean` flag.
  ~665 jobs / 615 quotations / 705 enquiries across all 7 branches over ~18 months, varied
  status/origin/serviceTypes/`quotedTotal` (INR + some USD), a deliberate ~70% on-time
  split on the delivery-date columns, workflow progress (real EXW/CIF template steps, with
  `updatedAt` back-dated via raw SQL) + `JobAuditLog` on a subset. Every demo row tagged —
  Organization `name` starts `"Demo · "`, Job/Quotation `sourceReference = "DEMO-SEED"`,
  Enquiry `rfqReason` starts `"[DEMO]"`; reference-number fields left NULL. `--clean`
  removes exactly this set. `prisma/seed.ts` untouched.

## DB models added

None new. Two additive nullable columns + one composite index on `Job` (see above).

## Endpoints added

| Method | Path | Gate |
|---|---|---|
| GET | `/api/reports/[report]/export` | `auth()` + `canSeeReport(role, report)`; BM branch-forced via `reportScope` |
| GET | `/api/dashboard/kpis` | `auth()` + role ∈ {ADMIN, BRANCH_MANAGER} |
| GET | `/api/dashboard/report.pdf` | `auth()` + role ∈ {ADMIN, BRANCH_MANAGER} |

Report **screens** (`/reports`, `/reports/[report]`) are server components — no JSON route.

## Endpoints changed

- `POST /api/jobs/[id]/workflow/steps/[stepId]` — `save` / `complete` now also write
  `Job.expected/actualDeliveryDate` (additive; no response-shape change).
- `PATCH /api/jobs/[id]` — accepts `expectedDeliveryDate` / `actualDeliveryDate` under the
  `workflowStatus` field group; a delivery-dates-only body is allowed on an in-progress /
  completed job.

## Permissions

- **`access-matrix.ts`** — no change (`reports` already granted to ADMIN/BM/SALES/ACCOUNTS).
- **`capabilities.ts`** — no change (reports gate on `canAccessScreen` + `canSeeReport` +
  `reportScope`, the `accounts`-screen precedent). No new `CapabilityScreen`.
- **`scope.ts`** (10a) — `reportScope` now has real consumers. `dashboardScope` unchanged.
- **`field-permissions.ts` / seed FieldPermission rows** — no change; the two new columns
  join the existing `workflowStatus` group.

## Key decisions

1. **On-time = actual delivery ≤ ETA at POD** (user-confirmed). Additive
   `expected`/`actualDeliveryDate`, seeded from the ETA / Delivered workflow steps,
   correctable by ADMIN/BM/DOER.
2. **One `[report]` dynamic route**, not four folders — validated against `REPORT_KEYS`.
3. **CXO KPIs on the same `/dashboard`**, role-gated (ADMIN + BM). "Download report" = a
   server `@react-pdf/renderer` PDF in a new `src/lib/pdf/dashboard/` module, not a
   screenshot, not the Stage-7 document pipeline.
4. **Amounts are summed as recorded, not currency-converted** — every money report carries
   a note; revenue additionally groups by branch/customer/service type without conversion.
5. **`seed-demo.ts` is committed + guarded + tagged** (not throwaway) so 10b totals and the
   10d perf pass are reproducible.
6. **BM branch scoping is fail-closed** — a BM crafting `?branchId=<other branch>` gets zero
   rows (`resolveReportBranchIds` → `NO_BRANCH`), verified.

## Explicitly deferred

- **Notifications** (bell, `/settings/notifications` real form, email seam) — 10c.
- **Audit-trail viewer** over `JobAuditLog` / `PortalAccessLog` / login log — 10d.
- **Security headers, OWASP route-auth sweep, perf indexes, `/api/test/job-fields` removal**
  — 10d.
- **Status-transition history** for a precise conversion funnel — out of scope; the report
  approximates from current status + downstream records.
- **Charge-level revenue split by ServiceType** — quoted revenue breaks down by charge
  category conceptually; the report uses `Job.serviceTypes` for the converted side only.

## Verification

Two throwaway scripts (deleted, not committed):

**`_tmp_verify_stage10b.mjs`** — per-role HTTP through the NextAuth credentials flow.
**34 checks, all passed:**
- ADMIN: `/dashboard` renders the CXO band + on-time donut; `/reports` lists all four;
  each `/reports/*` 200; `/api/dashboard/kpis` 200 JSON with the expected fields;
  `/api/dashboard/report.pdf` 200 `application/pdf`, >1 KB; `/api/reports/branch-performance/export`
  200 `text/csv` with a header + data rows.
- BRANCH_MANAGER (Mumbai): `/dashboard` + CXO band 200; branch-performance renders with
  **no branch-filter control**; CSV export contains **exactly one branch row — Mumbai** and
  no other branch names; `?branchId=<other id>` yields **zero rows** (fail-closed);
  `/reports/conversion` 200.
- SALES: `/reports` shows **only Conversion**; `/reports/conversion` 200; `/reports/revenue`
  redirects; `/api/reports/revenue/export`, `/api/dashboard/kpis`, `/api/dashboard/report.pdf`
  all **403**.
- ACCOUNTS: revenue + branch-performance 200; `/api/dashboard/kpis` **403**.
- DOER: `/reports*` redirect; `/api/reports/*/export` **403**.

**`_tmp_verify_10b_db.mts`** — pure-logic + reconciliation. **8 checks, all passed:**
- `deliveryDatePatchForStep`: import ETA → `expectedDeliveryDate`; import `delivered_status`
  → `actualDeliveryDate`; export `export_do_and_delivery` with no date → `actualDeliveryDate
  = now`; export `isFinal` fallback **skipped** when `actualDeliveryDate` already set.
- branch-performance **jobsCreated total, revenue total, and on-time %** all match an
  independent `prisma.job.groupBy` / `findMany` computation exactly (acceptance criterion
  "report totals match manually verified totals").
- `Job.expectedDeliveryDate` is writable and persists.

Plus: `prisma/seed-demo.ts` run → `--clean` (removed exactly 665/615/705/18) → re-seed
(identical counts — deterministic); `prisma/backfill/20260903_delivery_dates.ts` runs
clean (0 to fill, as expected with demo data). `tsc --noEmit`, `eslint src prisma`,
`npx next build` (all routes compile) clean.

## Failover

Additive nullable columns + one index; every new endpoint is read-only. Revert = drop
branch `stage-10b-reports-cxo`; the two `Job` columns and the index can stay (unused) or be
dropped separately. `seed-demo.ts --clean` fully removes the demo dataset. The dashboard
PDF has a 3-attempt retry and returns a 500 JSON (not a crash) on total failure.
