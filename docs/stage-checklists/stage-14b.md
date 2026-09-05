# Stage 14b — Quotation status pipeline

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Throwaway
per-role fetch verification against the running dev server passed (21/21), test rows
deleted afterward. Second of four Stage 14 sub-stages. Committed on branch
`stage-14b-quotation-pipeline` (off `stage-14a-enquiry-cleanup`); **not pushed**.

## What changed

The old 7-status quotation lifecycle (`DRAFT → PENDING_APPROVAL → APPROVED → SENT →
CUSTOMER_APPROVED → CONVERTED` + `NEEDS_CORRECTION`), built around a Branch-Manager
approval gate, is replaced by a Sales-driven pipeline with **no BM gate**:

```
FLOATED → COST_WORKING → QUOTATION_PREPARED → APPROVED → CONVERTED
```

- **FLOATED** — quotation created (enquiry attached), no costing done yet.
- **COST_WORKING** — the cost sheet is being filled (14c drives this transition).
- **QUOTATION_PREPARED** — sell-side line items exist; ready to approve. Line-item
  edits are in place here.
- **APPROVED** — the internal preparer (`quotations.edit`) marked the quote final.
  The current `QuotationVersion` is stamped `approvedById`/`approvedAt`; the customer
  is notified and the quote surfaces in the portal. Editing line items now clones a
  new version and drops back to `QUOTATION_PREPARED`.
- **CONVERTED** — one Job per attached enquiry, as before.

### Schema (migration `20260906090500_stage_14b_quotation_status`)
`enum QuotationStatus` gained `FLOATED`, `COST_WORKING`, `QUOTATION_PREPARED`. All 7
legacy values kept (additive-only) so pre-14b rows still render; `@default(DRAFT)`
untouched (the create route sets `status` explicitly, and changing a DB default in
the same migration that adds the value is unsafe in Postgres). Enum-add-only
migration, applied via the Neon adapter workaround.

### Routes (`src/app/api/quotations/`)
- `route.ts` — `STATUS_VALUES` gained the 3 pipeline values; `POST` creates
  `status: "FLOATED"` (was `DRAFT`).
- **New `[id]/approve/route.ts`** — `QUOTATION_PREPARED → APPROVED`,
  `can(role,"quotations","edit")`, 409 from any other status, 400 if the current
  version has 0 line items. In one `$transaction`: stamps the current
  `QuotationVersion` `approvedById`/`approvedAt` (load-bearing — `/convert` copies it
  into `jobSnapshot.quotation.approvedAt`, which the PDF renders), then sets
  `status: "APPROVED"` + `reviewedById`/`reviewedAt`. Fires `quotationReviewed
  ({decision:"approved"})` **and** `quotationSent(…)` — the latter is what pushes
  "New quotation — ready for your review" to the org's portal users.
- `[id]/convert/route.ts` — precondition `CUSTOMER_APPROVED` → `APPROVED` (+ error
  string). Snapshot build unchanged. `POST /api/jobs` / `from-quotation` still only
  check `status === "CONVERTED"` — unaffected.
- `[id]/line-items/route.ts` — `IN_PLACE_EDITABLE_STATUSES` = `["FLOATED",
  "COST_WORKING","QUOTATION_PREPARED","DRAFT","NEEDS_CORRECTION"]`;
  `CLONE_ON_EDIT_STATUSES` = `["APPROVED"]`; the clone branch's reset target is now
  `QUOTATION_PREPARED` (was `DRAFT`). `CONVERTED` / `PENDING_APPROVAL` 409 guards
  kept.
- `[id]/{submit,review,send,customer-approval}/route.ts` + the `quotations`
  `"approve"` capability + `ReviewModal` — **dead code, left callable** (Stage 12b
  precedent), each with a `// DEAD as of Stage 14b` header. Still work on legacy
  rows (verified: a `PENDING_APPROVAL` row can still be `/review`-approved by a BM).

### UI
- `quotations/page.tsx` — `STATUS_VALUES` + default tab `PENDING_APPROVAL` →
  `FLOATED`.
- `QuotationList.tsx` — `QuotationStatus` union + `STATUS_TABS` +
  `STATUS_BADGE_VARIANT` gained the pipeline values (legacy tabs trail for one
  release). `FLOATED`→pending, `COST_WORKING`/`QUOTATION_PREPARED`→active. The
  inline `PENDING_APPROVAL` Approve/Flag-Back is left (invisible for new rows).
- `QuotationDetail.tsx` — union + badge map updated; a horizontal **`StepTracker`**
  (Float Enquiry · Cost Working · Quotation Prepared · Approved · Converted, index
  from status via `pipelineIndex()`) added above the Charges card. Action bar is now
  just **Mark Approved** (`QUOTATION_PREPARED`) / **Convert to Job(s)** (`APPROVED`)
  + Download PDF + Copy for Email. The submit/review/send/customer-approval buttons,
  the customer-approval note card, `ReviewModal`, and the `canApprove` prop were
  removed. `[id]/page.tsx` no longer computes/passes `canApprove`.
- `src/lib/portal/queries.ts` — `QUOTATION_STATUS_VALUES` + the dashboard
  "quotations awaiting" count broadened to `{QUOTATION_PREPARED, APPROVED, SENT,
  CUSTOMER_APPROVED}`.
- `src/components/portal/portal-format.ts` — `quotationStatusVariant` maps
  `COST_WORKING`/`QUOTATION_PREPARED` → active.
- `src/lib/reports/conversion.ts` — the funnel read `sentAt`/`customerApproved`
  (never set by the new flow). Re-keyed: "Quotations prepared" (`status ∈
  {QUOTATION_PREPARED,APPROVED,SENT,CUSTOMER_APPROVED,CONVERTED}` or `sentAt`),
  "Approved" (`status ∈ {APPROVED,SENT,CUSTOMER_APPROVED,CONVERTED}` or
  `customerApproved`), "Converted to job" unchanged; win-rate denominator is now
  "prepared". Legacy flags still count for pre-14b rows.

## Decisions / notes
- No customer sign-off step — the customer is notified at APPROVED and agreement is
  out-of-band; `/convert` is reachable immediately after Mark Approved. Settled with
  the user ("Approved = end of quote flow").
- `seed-demo.ts` left as-is (old status values still valid); not extended with the
  new ones.
- `LINE_ITEMS_LOCKED_STATUSES` still literally `["PENDING_APPROVAL","CONVERTED"]` —
  line items are editable in every new pipeline status except `CONVERTED`.

## Verification (throwaway `tsx` fetch script, deleted, not committed)
Full pipeline as SALES: create → 201 `FLOATED`; `PUT /line-items` → in place, still
`FLOATED`, total correct; `POST /approve` while `FLOATED` → 409; (status forced to
`QUOTATION_PREPARED`) DOER `/approve` → 403, SALES `/approve` → 200 `APPROVED` with
version `approvedBy/At` stamped; `PUT /line-items` on `APPROVED` → v2 +
`QUOTATION_PREPARED`, v1 `approvedAt` preserved; re-approve v2 → `/convert` → 200
`CONVERTED` + `jobSnapshot` written; DOER `POST /api/jobs` → 201, `quotedTotal` =
v2 total. Legacy: a row forced to `PENDING_APPROVAL` still lists and BM `/review`
approve still 200. Page sweep `/quotations`, a detail page, `/reports/conversion`,
`/portal/quotations` → all 200. Test quotations/enquiries/job + throwaway ports
deleted afterward.

## Failover
Additive enum only. Revert = drop the migration's `ADD VALUE`s (or leave them,
harmless) and the changed files. Legacy quotations are untouched and still fully
actionable through the dead-but-live routes.
