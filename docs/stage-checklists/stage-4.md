# Stage 4 — Consignment / Job Creation + Historical Job Import

Status: **Complete.** Acceptance criteria verified 2026-09-01 via a full direct-API run (60 checks, all passed).

## What was built

- **Job entity** (`prisma/schema.prisma`, new "Stage 4" section) matching `docs/original-process-reference.pdf` pages 3 & 5 (Consignment Details): `shipmentType`, `serviceTypes`, `incoterm`, Agent/Place of Receipt/POL/POD/Place of Delivery/Shipping Line/CFS/Vessel/Voyage/Free Days at POD, gross/net weight, packages, CBM, commodity, HS code — plus `charges` (JSON snapshot), duty-payment fields, internal notes, and a human-readable ref (`JOB-YYYY-####`, same global-autoincrement pattern as `ENQ-`/`QUO-`).
- **Three separate party detail tables** (`ShipperDetail`, `ConsigneeDetail`, `NotifyPartyDetail`, each 1:1, `onDelete: Cascade`) — mirrors Stage 2's three `EnquiryXDetail` tables rather than one polymorphic table (deliberate, matches the doc's separate field blocks).
- **`ContainerDetail`** — repeatable add/edit/remove rows per Job (`ContainerDetailsEditor` mirrors Stage 3's `LineItemsEditor`), replace-children write strategy.
- **Two creation entry points** (`POST /api/jobs`): (a) from a `CONVERTED` quotation — one Job per `QuotationEnquiry`, pre-filled from its `jobSnapshot` with zero re-entry (`origin QUOTATION`); (b) direct create with no quotation — Doer picks branch + customer + shipment type (`origin DIRECT`). Plus `origin IMPORTED` via the bulk wizard.
- **Branch Manager final-review gate**: `DRAFT|NEEDS_CORRECTION → PENDING_REVIEW → WORKFLOW_IN_PROGRESS` (approve) or `NEEDS_CORRECTION` (flag back, note required). Submit re-validates strictly from DB state via `jobSubmitSchema` (`superRefine` keyed off `shipmentType` — Import additionally requires Agent Details + CFS Name, per the source PDF). `PENDING_REVIEW`/`WORKFLOW_IN_PROGRESS` jobs are edit-locked for non-Admins (ADMIN bypasses).
- **Central Job dashboard** (`/jobs`): status-tabbed list (mirrors `QuotationList`), branch + shipment-type filters, customer/vessel/port search, and **server-side pagination** (`?page`/`?pageSize` → `prisma.job.findMany` skip/take + `count`) — `DataTable` has no built-in paging, so it was added around it.
- **Job detail form** (`/jobs/[id]`, `JobForm`): resumable, `useAutosave`-wired, sections shown/gated by the Section 4.3 field-group matrix passed from the server page.
- **Bulk import wizard extended** (not rebuilt) for historical Jobs: `<ImportWizard entityType="JOB" />` at `/jobs/import` (Admin only). New `src/lib/import/validate-job-rows.ts` mirrors `validateCustomerRows`; `src/lib/validation/job.ts` holds the single schema shared by the form and the importer (Stage 1 decision #12). Imported Jobs land at their mapped `JobStatus` (`origin IMPORTED`), bypassing the review gate.

## DB models added

`Job`, `ShipperDetail`, `ConsigneeDetail`, `NotifyPartyDetail`, `ContainerDetail`. Enums: `JobStatus` (`DRAFT`, `PENDING_REVIEW`, `NEEDS_CORRECTION`, `WORKFLOW_IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `JobOrigin` (`QUOTATION`, `DIRECT`, `IMPORTED`). Additive back-relations: `Branch.jobs`, `Organization.jobs`, `User.createdJobs`/`jobsReviewed`, `QuotationEnquiry.job`, `ImportBatch.jobs`; new `@@index([entityType])` on `ImportBatch`. Migration `prisma/migrations/20260901110711_stage_4_job_creation/` — **no DROP/RENAME/ALTER-COLUMN** (verified; only `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT`). `ImportEntityType.JOB` + `ImportBatch.entityType` already existed from Stage 1 — no enum/column migration needed for those.

## Endpoints added

`GET/POST /api/jobs`, `GET/PATCH /api/jobs/[id]`, `POST /api/jobs/[id]/{submit,review}`, `GET /api/jobs/from-quotation?quotationId=` (lists a converted quotation's per-enquiry rows for the New Job screen, flagging any that already have a Job). All nested writes use `$transaction(..., { timeout: 20000, maxWait: 10000 })` — the plan's "single transaction across Job + detail tables" failover requirement.

## Endpoints changed (additive, not breaking)

- `POST /api/data-import/upload` — accepts an `entityType` form field, writes it to `ImportBatch.entityType`, picks target fields + auto-suggest set by type. Default `CUSTOMER` → existing customer flow unchanged.
- `POST /api/data-import/validate` + `/commit` — accept `entityType` in the body; dispatch to `validateCustomerRows` vs `validateJobRows`. `commit` refactored into `commitCustomerRows` / `commitJobRows`, both using the same guard → PROCESSING → array-form `$transaction([...createMany])` → COMPLETED/FAILED lifecycle. Job commit fans out into `job` + optional `shipperDetail`/`consigneeDetail`/`notifyPartyDetail`/`containerDetail` `createMany` with client-generated `randomUUID()` ids (the Stage 1 "batch, don't per-row" pattern).
- `GET /api/data-import` — optional `?entityType` filter (Customer page filters to `CUSTOMER`, `/jobs/import` to `JOB`).
- `suggestColumnMapping(headers, targetFields = CUSTOMER_TARGET_FIELDS)` — added the second parameter (previously closed over the const).
- `src/lib/import/types.ts` — `RowError`/`ValidatedRow`/`ValidationResult` lifted out of `validate-customer-rows.ts` (which now re-exports them) so the Job validator shares the shapes.

## Permissions

- **`capabilities.ts`** — added `"jobs"` to `CapabilityScreen` and per-role arrays (plan §4.2): Admin `view/create/edit/approve`; Branch Manager `view/edit/approve`; Doer `view/create/edit`; Sales `view`; Accounts `view/edit` (whole-screen edit so Accounts can reach the Job; the field-group gate then confines their writes to `charges`/`dutyPayment`/`documents` — same pattern as Customer Master v2 decision #3); Customer none (deferred to Stage 9, like enquiries/quotations).
- **`access-matrix.ts`, `field-permissions.ts`, `prisma/seed.ts`** — **no changes.** `"jobs"` nav visibility was already wired for all roles at Stage 0, and `JOB_FIELD_GROUPS` (`shipperConsigneeNotify`, `portVesselContainer`, `workflowStatus`, `charges`, `dutyPayment`, `internalNotes`, `documents`) with `resource "job"` was already seeded for all 6 roles.
- **`src/lib/permissions/job-fields.ts`** (new) — `getJobFieldAccess(role)` + `redactJobForRole(job, access)` (strips a group's columns/relations when access is `NONE`). Used by both `GET /api/jobs/[id]` and the server-rendered detail page, so a restricted role can't retrieve those fields even via direct API call. `src/lib/validation/job.ts` exports `JOB_FIELD_GROUP_KEYS` mapping each group to the autosave keys it governs; the PATCH route applies a group's keys only when the role has `EDIT` on it, and leaves a group it can't touch completely untouched (never nulled — Customer Master v2 decision #2).

## Key decisions (confirmed with the user before building)

1. **Two creation entry points** — from a CONVERTED quotation *and* direct create (not quotation-only). `JobOrigin` tracks provenance.
2. **Charge attribution: full set, editable copy.** Each Job from a quotation gets the whole quotation's line items copied into an editable `charges` JSON snapshot (`chargesCurrency`/`quotedTotal` alongside). **No automatic per-shipment split** when one quotation bundles N enquiries — the source process document defines no attribution rule. Carried forward as a documented assumption (originally flagged in Stage 3).
3. **POL/POD/Place of Receipt/Delivery/Shipping Line/CFS/Container Type are free-text `String`.** UI offers a hardcoded dropdown for Incoterm + common container types only. No Port/CFS/ShippingLine/ContainerType master tables this stage — same precedent as Customer Master v2's currency handling.
4. **Historical import: core + optional parties/containers, skips the review gate.** Required per row: core Job fields + a resolvable customer + a resolvable branch + a recognisable workflow status. Optional: shipper/consignee/notify-party + container columns, imported only when mapped. Imported Jobs land at their mapped `JobStatus` with `origin IMPORTED` — no Branch Manager review.

## Implementation decisions (made during the build, cheap to reverse)

- **Money stays `Float`** (schema-wide convention; flagged for a future accounting-stage revisit, same as Stage 3 / Customer Master v2).
- **`incoterm` + `serviceTypes` are in the `portVesselContainer` field group** for edit-gating purposes (they're routing/shipment attributes with no Section 4.3 row of their own) — keeps every autosave key mapped to exactly one group, so the PATCH route just iterates groups with no "general fields" bucket.
- **No empty party rows pre-created** on Job creation — the detail form handles `null` party details (the Enquiry form does the same for its detail blocks). First autosave upserts them.
- **`branch` is a required import column** (resolved by Branch name or code, case-insensitive) — `Job.branchId` is a non-null FK and historical rows must name their branch; no "default branch for the batch" shortcut.
- **`workflowStatus` import column** maps free-text (`"in progress"`, `"delivered"`, `"closed"`, …) to `JobStatus` via a synonym table; blank → `WORKFLOW_IN_PROGRESS`; an unrecognised non-blank value is a row error. `Job.status` is the only workflow state Stage 4 records — the real engine (`JobWorkflowProgress` etc.) is Stage 5/6.
- **New Job "from quotation" screen** discovers convertible quotations via `GET /api/quotations?status=CONVERTED` then `GET /api/jobs/from-quotation?quotationId=` for the per-enquiry rows.

## Explicitly deferred (per plan scope)

- **Workflow engine** (`WorkflowTemplate`/`WorkflowStep`/`JobWorkflowProgress`/`JobAuditLog`, Import/Export step sequences, step ownership) — Stage 5/6. Approval moves a Job to `WORKFLOW_IN_PROGRESS` with no steps behind it yet.
- **Per-Job charge editing UI** — the `charges` snapshot is displayed read-only on the detail screen; API-level editing by roles with `charges` EDIT works (verified), but a proper charge editor lands with the accounting stage.
- **Row-level field nuance** ("own entries only", DDP/DDU landed-cost visibility to Customer, editing `charges` on an already-active Job) — Stage 6/9. Stage 4 keeps the simple "editable only in DRAFT/NEEDS_CORRECTION (or ADMIN)" lock.
- **Documents** (HBL/MBL/DO/Invoice) — Stage 7; the `documents` field group stays permission-only.
- **Customer-portal Job access** — Stage 9 (needs `User.organizationId`).
- **Master tables** for Ports / CFS / Shipping Lines / Container Types / Currencies.

## Verification

Full direct-API run via a throwaway `tsx` script authenticating each role through the NextAuth credentials flow (60 checks, all passed):

1. **Zero re-entry** — bundled 2 same-org enquiries → ran the Stage 3 lifecycle to `CONVERTED` → `POST /api/jobs` per `QuotationEnquiry`: the Job's `shipmentType`, `incoterm`, POL/POD, HS/commodity, place of receipt/delivery, `charges` snapshot (2 lines), `chargesCurrency`/`quotedTotal` (1700), gross weight, and pre-seeded container row (40HC ×2) all matched the source with no re-entry. Second job from the same `QuotationEnquiry` → 409.
2. **Direct create** — Doer → 201 (`origin DIRECT`); Sales / Branch Manager / Customer → 403 (create is Admin + Doer only).
3. **Review gate** — Doer submit → `PENDING_REVIEW`; edit while pending → 409; Sales/Doer review → 403; flag-back with no note → 400; flag-back with note → `NEEDS_CORRECTION` + note stored; Branch Manager approve → `WORKFLOW_IN_PROGRESS` + `reviewedById`/`reviewedAt` stamped; edit while in-progress → 409; ADMIN edit any status → 200.
4. **Field-permission enforcement** — Sales `GET /api/jobs/[id]` omits `dutyPaymentLiability`/`dutyAmount`/`dutyPaidBy` and `internalNotes` entirely, `fieldAccess.dutyPayment === "NONE"`, keeps `portVesselContainer` data (VIEW). Accounts PATCH edits `charges` + duty fields (succeeds) while its attempts to set `portOfLoading` and `shipperDetail` leave those untouched (VIEW-only groups). Sales PATCH → 403.
5. **Transaction atomicity** — a PATCH that upserts `shipperDetail` then hits an out-of-range container `count` in the same `$transaction` → 500, and afterwards the Job has **no** shipper detail and **no** container rows (the earlier successful upsert rolled back).
6. **Dashboard scale + filters** — 1,200 dummy Jobs across branches/statuses/customers: list `total` matched the DB count exactly, `pageSize` respected, page 1 vs page 2 disjoint, customer-name search and vessel search matched DB counts.
7. **Historical import** — `tests/fixtures/generate-sample-jobs.ts` emitted 1,034 rows (1,000 valid + 12 unknown-customer + 8 bad-shipment-type + 8 bad-status + 6 missing-branch). Drove `/api/data-import` (upload/validate/commit, `entityType: "JOB"`) as Admin: validate reported exactly 1,000 valid / 34 flagged; commit → batch `COMPLETED` with `importedRows: 1000`, `invalidRows: 34`; all 1,000 Jobs `origin IMPORTED` at a mapped status (never `DRAFT`/`PENDING_REVIEW`), each with shipper/consignee detail rows and a container row; error CSV had 34 data rows.

`tsc --noEmit` and `npm run lint` both pass with zero errors. `tests/fixtures/generate-sample-jobs.ts` is committed (like `generate-sample-customers.ts`); its `.xlsx` output is gitignored. All verification data (`ZZZ`-prefixed orgs and everything linked to them, the 1,200 dummy jobs, the JOB import batch + rows, generated xlsx) deleted afterward — pre-existing dev data (`Test Exports Pvt Ltd`, its 4 enquiries, 1 quotation) left untouched. Throwaway scripts removed, not committed.

## Failover

Every Job write (Job + party details + containers) is wrapped in one `$transaction` — verified by forcing a mid-write failure and confirming no partial rows (check 5). No tag/push for this stage's completion — same as Stages 1–3, pushing to `origin/main` is a separate explicit user request.
