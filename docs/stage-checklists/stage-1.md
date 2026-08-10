# Stage 1 — Master Data + Bulk Import Wizard

Status: **Complete.** Acceptance criteria verified 2026-08-10.

## What was built

- **Customer directory** (`/customers`): search/filter (name, contact, GST, branch, active status), create/edit via modal, soft-delete (deactivate/reactivate) only — no DELETE route exists on the API at all, so "soft delete only" is structurally enforced, not just policy.
- **Organization/KYC**: `Organization` + 1:1 `KycDetail` (GST/PAN/TAN), GST format validation and duplicate-GST detection (blocks with a warning naming the existing org, per Section 5.1).
- **Branch management** (`/settings/branches`, Admin only) and **User management** (`/settings/users`, Admin only): CRUD via the same list+modal pattern as Customers. Branch Manager gets a read-only card of their own branch at `/settings`.
- **Bulk import wizard** (`/data-import`, Admin only): Upload → Map Columns → Validate → Commit → Summary, with auto-suggested column mapping, a validation preview before any DB write, transactional commit, a batch history table, and a downloadable per-row error CSV.
- **New permissions layer**: `src/lib/permissions/capabilities.ts` — per-action (view/create/edit/delete) capability per role, additive to Stage 0's `access-matrix.ts` (which only ever handled sidebar visibility).
- **Shared validation**: `src/lib/validation/{kyc,organization}.ts`, used identically by the interactive Customer form and the bulk importer — one implementation, not two.
- New UI primitive: `FileDropzone` (added to `src/components/ui`).

## DB models added

`Organization`, `KycDetail`, `ImportBatch`, `ImportRowError`. Enums: `ImportEntityType`, `ImportBatchStatus`. Additive changes to existing models: `Branch.isActive` (soft-deactivate), plus required back-relation fields on `Branch`/`User`.

## Key decisions / deviations from the plan

1. **`xlsx` (SheetJS) swapped for `exceljs`.** The plan doc's tech stack names "xlsx/SheetJS," but the only version on the npm registry (`0.18.5`) has two unpatched high-severity advisories (prototype pollution, ReDoS) with no fix available on npm — SheetJS only publishes patched builds to their own CDN, not npm. Since this library parses admin-uploaded files, shipping the vulnerable version wasn't a reasonable default; raised it and the user chose `exceljs` (actively maintained, no direct advisories). `exceljs` does carry one moderate transitive advisory via its `uuid` dependency (unrelated to file parsing — internal ID generation, not exercised on untrusted input), accepted rather than downgrading to an older `exceljs` major just to silence it.
2. **Bulk commit inserts via batched `createMany`, not one `.create()` per row.** The first implementation did one `organization.create()` (with a nested `kycDetail.create()`) per row inside a single Prisma transaction. Against the Neon endpoint (ap-southeast-1), each row was a real network round trip — 170 sequential round trips reliably blew even a 30-second transaction timeout on pure network latency, with no actual server-side bottleneck. Fixed by generating IDs client-side (`crypto.randomUUID()`, overriding the schema's `@default(cuid())` default) and inserting via `organization.createMany` + `kycDetail.createMany` — 2–3 round trips total regardless of row count. Confirmed via the 200-row fixture: import now completes in a few seconds. This is a correctness/scale fix, not a scope change — the atomicity and per-row-validity contract from the approved plan is unchanged.
3. **Atomic batch commit via array-form `$transaction`, not per-row try/catch inside one transaction.** The approved plan's design note described catching each row's insert error individually *inside* a single transaction so one bad row wouldn't abort the rest. That doesn't work under Postgres: once any statement inside a transaction errors, Postgres aborts the whole transaction until rollback — every later statement in that same transaction fails too, silently corrupting the batch. Implemented instead as one array-form `$transaction([...])`: pre-validated valid/invalid rows are pre-split before the transaction (so nothing unexpected should fail inside it), and if something still fails (e.g. a genuine race-condition duplicate), the *entire* transaction rolls back and the batch is marked `FAILED` with no partial data — which is actually a more literal match for the failover spec's "a failed batch rolls back entirely, not leave partial data" than the original per-row-catch design would have been.
4. **Branch Manager's "Edit" on Customers is global**, not restricted to their own branch — `Organization.branchId` is informational/filterable metadata, not an access boundary.
5. **Branch Manager's "branch settings only"** = read-only view of their own branch card; all User management stays Admin-only (Section 4.2 has no explicit "Users" row).
6. **GST is optional at creation**, validated only if present — the acceptance criteria's own example broken rows are "malformed GST" and "missing **name**," not "missing GST."
7. **Customer role has no capabilities on `/customers` in Stage 1** — "view own org only" needs `User.organizationId`, which Section 9.2 introduces in Stage 9, not before. Customer-role users see an explanatory placeholder instead of an error or the full directory.
8. **Fixed a Stage 0 component bug while integrating it**: `DataTable<T extends Record<string, unknown>>`'s generic constraint didn't structurally accept plain named interfaces (only worked by accident on Stage 0's untyped demo data) — every real usage in this stage failed to type-check. Relaxed to `DataTable<T>` with an internal cast at the one place indexing is needed. No behavior change, no API change for existing/future callers.

## Verification

1. `npx prisma migrate dev` applied cleanly against Neon; `tsc --noEmit` and `npm run lint` both pass with zero errors.
2. Customer CRUD + validation: created a customer with a valid GST, confirmed a duplicate GST is blocked (409, names the existing org), confirmed a malformed GST is rejected (400).
3. Per-role capability enforcement verified via direct API calls (not just hidden buttons) for all 6 roles: Doer can create but not edit (403 on PATCH); Branch Manager can edit but not create (403 on POST); Accounts is fully read-only (403 on create and on deactivate); Sales can create and edit; Customer gets 403 on the list endpoint; Admin can do everything including deactivate.
4. Branches/Users: Admin can create a branch and a user; Branch Manager can view branches but not create one (403), and is blocked from `/settings/users` and `/api/users` entirely (redirect / 403); Doer has no branch visibility at all (403).
5. **Bulk import, full run**: generated the ~200-row fixture (`tests/fixtures/generate-sample-customers.ts`: 170 valid, 15 missing name, 10 malformed GST, 5 duplicate GST) and drove the wizard end-to-end as Admin — upload → auto-suggested mapping matched every column correctly → validate reported exactly 170 valid / 30 flagged, with the expected error breakdown → commit completed in a few seconds, importing 170 and logging 30 `ImportRowError` rows → error CSV downloaded with matching row-level detail → Customer directory reflected the 170 new rows.
6. Confirmed the two earlier (pre-fix) failed commit attempts left **zero** partial data — the atomicity guarantee holds in practice, not just in the code path.
7. All verification/test data (test organizations, test branch, test user, the 170 imported rows, and the import batch history from testing) was cleaned up after verification so the database starts Stage 2 empty of throwaway data.

## Failover

No tag/push for this stage per the plan — Stage 0's tag was an explicit requirement in the plan doc itself; Stage 1 has no equivalent requirement, and the prior push to GitHub was a separate explicit user request, not a default action.
