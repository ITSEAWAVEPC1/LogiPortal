# Stage 7 — Document Generation & Management

Status: **Complete.** Acceptance criteria verified 2026-09-02 via a full direct-API run (52 checks, all passed) — per-role HTTP calls through the NextAuth credentials flow, plus one in-process check for the forced-render-failure path, plus rendered-page checks.

## What was built

- **Five generated document kinds + free-form uploads**, each tied to a Job, versioned, permission-scoped per plan §4.3. Generated via `@react-pdf/renderer` (reusing Stage 3's exact pattern). **Fidelity decision (confirmed with the user): minimal now.** Freight Certificate (the 9 spec'd figures) and Invoice (from the Job's `charges` snapshot, grouped by the 4 charge categories, total = `quotedTotal`) are full layouts; HBL / MBL / Delivery Order are clean branded stubs — the operationally authoritative copy for those is the **uploaded** carrier file, so the upload path is first-class for every kind.
- **Storage: Postgres `Bytes` column** (`DocumentVersion.bytes`), behind `src/lib/pdf/document-storage.ts` (`toVersionStorageFields` / `readVersionFile`) so a later swap to Vercel Blob is a one-file change. No new dependency, no env var. `toVersionStorageFields` copies into a fresh `Uint8Array` — Prisma 7's `Bytes` type rejects a `Buffer<ArrayBufferLike>`.
- **Synchronous generation with a 3-attempt retry loop** (`generateDocumentPdfWithRetry` in `src/lib/pdf/render-document-pdf.tsx`). No queue infra yet (Stage 8/10). On success the version stores bytes + `generationStatus SUCCEEDED` + `generationAttempts`; after 3 failures the version row is still created (`bytes` null, `FAILED`, `generationError` set) and the file route returns `{ fallback: true, data }` (200) so the client renders `DocumentHtmlPreview` from the retained `sourceSnapshot` — the Stage 3 failover pattern, real code. The render + retry runs **inside** the create transaction, so a Document never exists without a v1.
- **Document lifecycle**: `DRAFT → (submit) → PENDING_APPROVAL → (Branch Manager review) → APPROVED | REJECTED`. A rejected doc drops back to `DRAFT` on re-submit; a new version (regenerate or upload) resets the doc to `DRAFT` and clears the approval/share stamps. `sharedWithCustomer` is a separate Branch-Manager toggle, only settable on an `APPROVED` doc (409 otherwise).
- **Customer read path implemented now** (confirmed with the user — a departure from the Stages 4–6 "defer all Customer Job access to Stage 9" pattern). Added a minimal additive `User.organizationId` (nullable FK). A CUSTOMER sees only `APPROVED` + `sharedWithCustomer` documents whose Job belongs to their linked org; an unlinked customer sees nothing. Resolved per-request via `resolveViewerOrgId` (no auth-callback/session-shape change this stage).
- **Per-Job `DocumentsPanel`** on `/jobs/[id]` (full-width, below the form/workflow grid, shown once the Job is past DRAFT/PENDING_REVIEW/NEEDS_CORRECTION and the role has `documents` field-group + capability access). Generate dropdown, Upload modal (`FileDropzone`), per-row View / version history / Regenerate / Submit / Approve / Reject / Share / Deactivate gated by `getDocumentAccess`. Mirrors `WorkflowPanel` (self-fetch, `queueMicrotask`, `router.refresh()` never needed — the panel reloads itself).
- **Global `/documents`** — replaced the `StagePlaceholder`. Server page resolves the role's visibility WHERE via `buildDocumentListWhere` (org-scoped for CUSTOMER, `isFinancial:false` for SALES) → read-only `DocumentsBrowser` (`DataTable` + kind/status/text filters, links to the Job, opens the current version's file).
- **`/settings/document-types`** — near-verbatim `BillTypeManager` clone (DataTable + Modal CRUD). A `<Link><Card>` tile added to `/settings`. Admin can add **upload-only** categories (always `kind OTHER`, `isGeneratable false`); the 5 generatable built-ins are seed-only.
- **`StepDetailCard`** — for document-bearing step keys (`draft_hbl_approval`, `onboard_hbl_details`, `mbl_details`, `freight_certificate_prep`, `bill_preparation`, `delivery_order_release`, `export_bl_type`, `export_bl_release`, `export_bill_preparation`, `export_do_and_delivery`) shows a static hint linking to the `#job-documents` section. The document and workflow-step state machines are **independent** — completing a step never requires a document.

## DB models added

`DocumentType`, `Document`, `DocumentVersion`. Enums: `DocumentKind` (`HBL | MBL | FREIGHT_CERTIFICATE | DELIVERY_ORDER | INVOICE | OTHER`), `DocumentOrigin` (`GENERATED | UPLOADED`), `DocumentStatus` (`DRAFT | PENDING_APPROVAL | APPROVED | REJECTED`), `DocumentGenerationStatus` (`NOT_APPLICABLE | SUCCEEDED | FAILED`). New column `User.organizationId` (nullable FK → `Organization`, `onDelete: SetNull`). Additive back-relations: `Job.documents`, `JobWorkflowProgress.documents` (optional `Document.jobWorkflowProgressId` link), `Organization.users` (relation `"OrganizationUsers"`), `User.documentsCreated`/`documentsApproved`/`documentVersionsCreated`.

Migration `prisma/migrations/20260902102227_stage_7_document_generation/` — **20 statements, all `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD COLUMN` (nullable) / `ADD CONSTRAINT`** (verified — no DROP/RENAME/ALTER COLUMN). `Document.bytes` is `BYTEA`; `Document.sequenceNumber` / `DocumentVersion` use the same `SERIAL`/autoincrement `DOC-YYYY-####` ref pattern as `JOB-`/`QUO-` (`formatDocumentRef` in `src/lib/validation/document.ts`).

`Document` uses `currentVersionNumber: Int` (mirrors `Quotation.currentVersionNumber`) — **not** a self-referential `currentVersionId` FK. `serializeDocument` resolves the current version's id/status from the `versions` list.

## Endpoints added

- `GET /api/documents?jobId=&kind=&status=` — list, `buildDocumentListWhere` applied (financial filter for SALES, `APPROVED`+`shared`+org scope for CUSTOMER). `bytes` never selected.
- `POST /api/documents` — `can(role,"documents","create")`. JSON `{ jobId, documentTypeCode, jobWorkflowProgressId?, title? }` = generate; `multipart` (`file` + same fields) = upload. Financial types (`INVOICE`/`FREIGHT_CERTIFICATE`) require `ACCOUNTS`/`ADMIN` (`canCreateDocument`). Creates `Document` (DRAFT) + `DocumentVersion` v1 in one `$transaction`.
- `GET /api/documents/[id]` — metadata + full version list, `canReadDocument` checked. `PATCH` — `{ sharedWithCustomer }` (BM/Admin, doc must be APPROVED), `{ isActive:false }` (Admin), `{ title }` (creator/Admin). No DELETE verb.
- `POST /api/documents/[id]/submit` — creator/Admin, `DRAFT|REJECTED → PENDING_APPROVAL`.
- `POST /api/documents/[id]/review` — `can(role,"documents","approve")`, `{ action: "approve"|"reject", note? }` (note required on reject). `DRAFT|PENDING_APPROVAL → APPROVED` (+ stamp) | `REJECTED` (+ note, clears approval/share).
- `POST /api/documents/[id]/versions` — creator/Admin. JSON `{ mode: "regenerate" }` (GENERATED only) or `multipart` (new uploaded file). `versionNumber = max(existing, current) + 1`, bumps `currentVersionNumber`, resets to `DRAFT`, **prior versions + bytes untouched**.
- `GET /api/documents/[id]/versions/[versionId]/file` — `canReadDocument` checked; streams `new NextResponse(new Uint8Array(bytes), …)` `Content-Disposition: inline`, or `{ fallback: true, data }` 200 when the version is `FAILED`/byteless.
- `GET /api/document-types` (open to any `documents:view` role — the panel needs it) / `POST` (Admin `documentTypes:create`). `PATCH /api/document-types/[id]` (`edit` for name/`customerVisibleDefault`, `delete` for `{ isActive }`).

## Permissions

- **`capabilities.ts`** — added `"documents"` + `"documentTypes"` to `CapabilityScreen`. `documents`: ADMIN `view/create/edit/approve/delete`; BRANCH_MANAGER `view/approve`; DOER `view/create`; SALES `view`; ACCOUNTS `view/create`; **CUSTOMER `view`** (first Customer capability in the app). `documentTypes`: ADMIN only.
- **`src/lib/permissions/document-access.ts`** (new, pure — no prisma, mirrors `job-fields.ts`) — `getDocumentAccess(role)` → `{ canView, canCreate, canCreateFinancial, canApprove, canShareToggle, canDeactivate, canEditMeta, seesFinancial, onlyApprovedShared, orgScoped }`; `buildDocumentListWhere(role, orgId, extra?)`; `canReadDocument(role, orgId, doc)`; `canCreateDocument(role, isFinancial)`. This is the §4.3 nuance layer (Sales non-financial-only, Accounts owns financial creation, BM approves-not-uploads, Customer approved+shared+org-scoped) — same coarse-capability + nuance-layer split Stage 6 used for duty payment.
- **`access-matrix.ts`** — no change (`documents` nav already wired for all 6 roles since Stage 0).
- **`prisma/seed.ts` `FieldPermission` rows** — **no change.** The existing `documents` group (ADMIN/BM/DOER/ACCOUNTS `EDIT`, SALES/CUSTOMER `VIEW`) stays the coarse "can this role reach the section" gate; `document-access.ts` is authoritative for the finer rules. `seed.ts` gained a `DOCUMENT_TYPES` upsert loop (6 rows, idempotent — verified stable across 2 runs).

## Key decisions (confirmed with the user before building)

1. **Storage = Postgres `Bytes` column** (not Vercel Blob / not local FS). No token, works offline, swap-later seam in `document-storage.ts`.
2. **PDF fidelity = minimal now.** Freight Certificate + Invoice full; HBL/MBL/DO branded stubs with upload as the real path. Full carrier-form facsimiles are a later pass.
3. **Generation = synchronous + 3× retry loop**, not a job table + polling. Queue-backed async deferred to Stage 8/10; the `generation*` columns are the forward-compatible seam.
4. **Customer read implemented now** (not deferred to Stage 9 like every other Customer Job-access nuance). Needed the additive `User.organizationId` column. Stage 9 promotes it into the session and adds cross-entity (Jobs/Quotations/Enquiries) row-scoping + an admin UI to set it.

## Implementation decisions (made during the build, cheap to reverse)

- **`DocumentType` is a seeded table** (BillType twin), not an enum — satisfies the plan's model list and lets an admin add upload-only categories without a deploy. Generatable dispatch keys off `code`.
- **Render + retry runs inside the create `$transaction`** (`{ timeout: 20000 }`) — a ~200-500ms PDF render is well within budget and it guarantees a Document always has exactly one v1. The Quotation PDF renders outside a txn, but there was no correctness reason to here.
- **`currentVersionNumber: Int`** over a self-referential FK — matches `Quotation` and sidesteps Prisma's disambiguation for a model that also has a `versions` list.
- **Money stays `Float`** (schema-wide convention; Invoice amounts read straight from the `Job.charges` snapshot).
- **`DocumentHtmlPreview`** renders the same `DocumentPdfData` union as the PDF components — used both as the generation-failure fallback and as an in-app preview, same as `QuotationHtmlPreview`.

## Explicitly deferred (per plan scope)

- **Queue-backed async generation** — Stage 8/10 (Vercel Cron / Upstash).
- **Vercel Blob storage** — swap `document-storage.ts` at deploy time.
- **Full carrier-form HBL/MBL/DO facsimiles** — later fidelity pass.
- **Session-level `organizationId` + cross-entity Customer row-scoping + admin UI to link a customer user to an org** — Stage 9. Stage 7 adds only the nullable column and the documents-scoped query; a customer user is linked directly in the DB for now.
- **Email delivery / quotation-style "send" of a document to the customer** — Stage 10 (notifications).
- **Field-level Job-form diffing into `JobAuditLog`** — still Stage 10 (unchanged by this stage). Stage 7 writes no `JobAuditLog` rows.
- **Per-step document filtering in `DocumentsPanel`** — the `focusStepId` prop + `jobWorkflowProgressId` link exist and are stored; the `StepDetailCard` link is a plain anchor, not a live filter, this stage.

## Verification

Throwaway `tsx` script (`verify-stage7.mts`, deleted after) — per-role HTTP calls through the NextAuth credentials flow against the running dev server, plus direct Prisma for setup/assert/teardown and one in-process check. **52 checks, all passed:**

1. **Generate all 5** from a ZZZ Import (EXW) + ZZZ Export (CIF) Job with seeded workflow-step data — each `POST /api/documents` → 201, `generation.status SUCCEEDED`, `attempts ≥ 1`; the file route returns `application/pdf` bytes starting `%PDF`.
2. **Data correctness** — Freight Certificate `sourceSnapshot` carries the 9 figures (`oceanFreightUsd 1200`, `exWorksUsd 340`, …); Invoice snapshot has 3 line items, `total === quotedTotal (1440)` and equals the line-item sum.
3. **Versioning** — `POST versions {mode:"regenerate"}` → `currentVersionNumber 2`, status `DRAFT`; v1 row + bytes byte-identical and same `createdAt` afterward; 2 version rows.
4. **Upload** — multipart POST as DOER → 201, `origin UPLOADED`, `generationStatus NOT_APPLICABLE`; download is byte-for-byte identical.
5. **Retry + failover** — `pdfRenderer.render` monkeypatched to throw → version has `generationAttempts 3`, `FAILED`, `bytes` null, `generationError` set; file route → `{ fallback: true, data }` 200.
6. **Role matrix** — SALES list omits INVOICE/Freight-Cert, direct GET → 403; DOER `POST INVOICE` → 403, `POST HBL` → 201; DOER submit → `PENDING_APPROVAL`, DOER review → 403; BM reject-no-note → 400, reject+note → `REJECTED`+note, re-submit → BM approve → `APPROVED` + `approvedBy`; DOER share → 403; BM share APPROVED → 200, BM share non-APPROVED → 409.
7. **Customer read** — CUSTOMER linked to the ZZZ org sees exactly the 2 `APPROVED`+`shared` docs; direct GET on a non-shared doc → 403; an unlinked CUSTOMER sees nothing and gets 403 on another org's doc.
8. **Soft delete** — ADMIN `PATCH {isActive:false}` → 200, row drops from the list; DOER → 403. `document-types`: DOER GET 200 / POST 403; ADMIN POST → `kind OTHER`, `isGeneratable false`.
9. **Rendered pages** — `/documents`, `/settings/document-types`, a Job `/jobs/[id]` → 200 for Admin; SALES `/settings/document-types` → redirect.

`npx prisma migrate dev` applied cleanly (20 additive statements). `npm run db:seed` run twice — stable at 6 `DocumentType` rows. `tsc --noEmit` and `npm run lint` both zero errors. All `ZZZ-STG7` orgs/jobs/documents/versions/sessions + the linked customer users deleted afterward (a `finally` block; a first run's teardown tripped on the `Session` RESTRICT FK — fixed to delete sessions first); the 6 seeded `DocumentType` rows and pre-existing dev data left untouched. Throwaway script removed, not committed.

## Failover

Generation retries 3× in-request, then degrades to a real HTML preview from the retained `sourceSnapshot` (not a stub). Prior document versions and their bytes are never mutated by a regenerate/new-upload. No tag/push for this stage's completion — pushing to `origin/main` is a separate explicit user request.
