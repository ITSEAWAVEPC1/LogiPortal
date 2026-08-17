# Customer Master v2 — Organization enhancement

Status: **Complete.** Built on top of Stage 1's Organization model — all other stages treated as correct/finished and untouched, except the two additive endpoint changes noted below.

## Step 0 safety check

Organization table had exactly **1 row** at the start (`"Test Exports Pvt Ltd"`, GST `27AAAAA0000A1Z5` — an obviously synthetic pattern), so this was seed/dummy data, not real customer data. Schema changes were still kept additive-only (no drops/renames) as a habit per the plan's failover rule, but no down-migration/backfill was needed since there was nothing real to preserve. Tagged `customer-master-v2-start` on the pre-change commit as the rollback point.

## What was built

- **Role flags on Organization**: `isShipper`, `isConsignee`, `isAgent`, `isCarrier`, `isService`, `isGlobal` + `alias` — editable via checkboxes in both the quick-create modal (`CustomerFormModal`, used by Enquiry's inline "+ Create new customer") and the full editor's General tab.
- **Branches** (`OrganizationBranch`) — a customer/vendor org's own branch offices, distinct from the existing `Branch` model (Seawave's internal offices). Each has `BranchAddress[]` ("More Addresses"), `BranchContact[]` (exactly one `isPrimary`, enforced server-side), `BranchAccountManager[]`, and `OrganizationBankAccount[]` (Payable/Receivable).
- **Account Info**: `CustomerAccountInfo` and `VendorAccountInfo`, both 1:1 with Organization, save/display independently.
- **Billing**: admin-configurable `BillType` master (seeded from the reference screen's visible list — see below) with a `/settings/bill-types` CRUD screen; `OrganizationBillType` join model (dueAfterDays, overrideCreditPeriod, billTo Direct/Other + optional org reference, clubCharges); `Organization.defaultCurrency`.
- **Customize Columns**: new reusable `ColumnPicker` UI primitive (`src/components/ui/ColumnPicker.tsx`) — Available/Selected dual-list, screen-agnostic by design for reuse in Reports later. Persisted per user via new `UserColumnPreference` model + `/api/preferences/[screenKey]`.
- **Full Organization editor**: `/customers/new` and `/customers/[id]` pages (`OrganizationEditor` + General/Branches/Account Info/Billing tab components under `src/app/(dashboard)/customers/_components/`), replacing the old quick-modal as the "Edit" destination from the list. The quick modal (`CustomerFormModal`) still exists, trimmed to name/alias/role-flags/contact/KYC, used only for Enquiry's inline create.

## DB models added

`OrganizationBranch`, `BranchAddress`, `BranchContact`, `BranchAccountManager`, `OrganizationBankAccount`, `CustomerAccountInfo`, `VendorAccountInfo`, `BillType`, `OrganizationBillType`, `UserColumnPreference`. Enums: `BankAccountKind`, `BillToType`, `DueDateBasis`, `ClubChargesOption`. Additive fields on `Organization`: `alias`, 6 role-flag booleans, `defaultCurrency`. Migration: `prisma/migrations/20260817035156_customer_master_v2/` — no DROP/RENAME statements (verified).

## Endpoints added

- `POST /api/bill-types`, `PATCH /api/bill-types/[id]` (Admin CRUD; GET is open to anyone who can view Customers, for the Billing tab's dropdown).
- `GET /api/users/picker` — minimal id/name/role staff lookup for Sales Person/Collection Executive/Account Manager dropdowns, open to any role that can create/edit Organizations (not Admin-only like `GET /api/users`).
- `GET/PUT /api/preferences/[screenKey]` — per-user column preference.
- `GET /api/customers/[id]` — include extended to the full nested shape (`organizationDetailInclude`).

## Endpoints changed (additive, not breaking)

- `POST /api/customers`, `PATCH /api/customers/[id]` — now accept the full nested payload (branches + their addresses/contacts/account managers/bank accounts, Account Info, Bill Types, role flags, alias) via `organizationDetailInputSchema`, which extends the original `organizationInputSchema` with `.optional()`/`.default([])` fields so the bulk importer (`validate-customer-rows.ts`, Stage 1, untouched) keeps validating unchanged.
- `GET /api/customers` (list) — added `alias` to the search fields and an optional `?role=shipper|consignee|agent|carrier|service` filter (used for the acceptance-criteria #6 spot-check below; no existing screen has a per-role picker yet to wire it into).

## Key decisions

1. **Replace-children write strategy.** Every save deletes and recreates a section's rows wholesale (branches + their children; bill types) rather than diffing row-by-row. Safe because nothing outside an Organization's own subtree references these child ids yet. Documented in `write-organization-children.ts`.
2. **Section-level permissions don't wipe what they can't touch.** A role without EDIT on Billing/Account Info/Branches leaves those tables completely untouched on save (not emptied) — verified directly: an Accounts-role PATCH that couldn't touch `branches` left the existing branch intact; a Doer-role PATCH that couldn't touch Billing/Account Info left `defaultCurrency`/`creditLimit` unchanged.
3. **Accounts needs write access despite lacking Stage 1's coarse `customers:"edit"` capability.** PATCH now allows the request through if the role has *either* whole-resource edit rights (General tab) *or* any Section 4.3 field-group EDIT (Account Info/Billing/Branches) — each section's write is still independently gated. POST (create) is unchanged: still gated by `customers:"create"` only, since creating a brand-new Organization was never in Accounts' Stage 1 remit and the task didn't ask to expand it.
4. **New `organization` field-group resource** (`accountInfo`, `billing`, `branches`, `addresses`, `contacts`) seeded in `prisma/seed.ts` alongside the existing `job` resource: Admin EDIT everywhere; Accounts EDIT on accountInfo/billing, VIEW on branches/addresses/contacts; Branch Manager & Doer EDIT on branches/addresses/contacts (mirroring their existing non-financial `job` rights), VIEW on accountInfo/billing; Sales VIEW everywhere (financial fields view-only, per the task).
5. **Bank accounts modeled flat in the UI, nested in the API.** The reference screen shows Bank Details as one flat grid with an "Organization Branch" column, but the schema's `OrganizationBankAccount.branchId` is a required FK (branches own their bank accounts). The editor's Account Info tab presents a flat table; `to-api-payload.ts` groups rows by branch before submitting, matching the API's nested shape.
6. **Money fields are `Float`, not `Decimal`.** No prior Decimal usage anywhere in this schema and no accounting stage built yet — Decimal would add JSON-serialization handling for the first money field with no established convention to match. Flagged for revisit whenever a real accounting stage lands.
7. **Transaction timeout bumped to 20s** (`{ timeout: 20000, maxWait: 10000 }`) on both POST/PATCH transactions, and the full-nested-include read moved *outside* the transaction (fetched after commit). Same root cause Stage 1 hit with bulk import (Neon ap-southeast-1 real network latency vs. the 5s interactive-transaction default) — confirmed by reproducing the `P2028` timeout on the first verification run and fixing it the same way.
8. **Primary-contact enforcement is a normalize, not a reject.** Zero `isPrimary` flags → first contact auto-promoted; more than one → all but the first demoted. Verified server-side via a submission with two contacts both flagged primary; the response came back with exactly one.

## Explicitly deferred (per task scope)

- **Reg tab** (statutory registration numbers/validity) — no screen built. Left room in the data model only where trivial (none needed; Reg fields don't overlap anything built here).
- **Integrations tab** (partner job/invoice sharing) — not built.
- **Full TDS depth** (fiscal year, section codes, certificates, exemption limits, 206AB status) — only the simplified `tdsReceivable`/`tdsPayable` booleans exist, per the task's explicit simplification.
- **Currency master table** — not built; `currency`/`defaultCurrency`/`transactionCurrency` are free-text fields backed by a small hardcoded list (`CURRENCIES` in `_components/types.ts`) in the UI, not a DB-backed master, since Systems/Currencies was out of scope for this task.

## Assumptions flagged for a future task to confirm (couldn't be verified from the reference PDF — later pages were screenshots with dropdowns never opened)

- `OrganizationBranch.taxableType` — only "Standard" was visible; kept as free-text defaulting to `"Standard"` rather than guessing the full enum.
- `VendorAccountInfo.dueDateCalculatedOn` (`DueDateBasis` enum) — only "Transaction Date" was visible; `INVOICE_DATE`/`BILL_DATE` are placeholders.
- `OrganizationBillType.clubCharges` (`ClubChargesOption` enum) — only "No Grouping of Invoice Charges" was visible; `GROUP_BY_SHIPMENT`/`GROUP_BY_JOB` are placeholders.
- `BranchAccountManager.forCategory` — only two example values ("Consignee Sea"/"Consignee Land") were visible; kept free-text rather than an enum.
- **Bill Type master seed list** (18 values, preserved verbatim including the source system's own spelling, e.g. "REIMBURESEMENT") reflects only what was visible in the reference screen's dropdown without scrolling further — may not be the complete list.

## Verification

1. `npx prisma migrate dev` applied cleanly against Neon (no data loss — 1 pre-existing row confirmed intact); `tsc --noEmit` and `npm run lint` both pass with zero errors/warnings.
2. Direct API calls per role (Node fetch script against the real NextAuth credentials flow, not UI clicking), then cleaned up:
   - Bill Types: Admin create → 201; Sales create → 403; Sales GET (dropdown use) → 200.
   - Organization create (Admin) with one branch (address + 2 contacts both flagged primary + 1 bank account) + Customer Account Info + 1 Bill Type, in a single transaction: branch/contact/bank-account counts all correct, primary-contact count normalized to exactly 1, `customerAccountInfo.creditLimit` persisted.
   - `?role=shipper` filter correctly found the newly created org (`isShipper: true`).
   - Accounts-role PATCH: changed `creditLimit`/`defaultCurrency` (allowed sections) while `name` and `branches` were silently left untouched (name/branches edit not permitted) — confirms server-side enforcement, not just UI-hidden.
   - Doer-role PATCH: replaced `branches` (allowed) while `creditLimit`/`defaultCurrency` were left untouched (Account Info/Billing not permitted).
3. Reproduced and fixed a real transaction-timeout bug (`P2028`, same root cause as Stage 1's bulk-import fix) during this verification, not just in theory.
4. Smoke-checked `/customers`, `/customers/new`, `/settings/bill-types`, `/settings` all render 200 with no error content, as Admin.
5. All verification/test data (`ZZZ`-prefixed test organization and bill type) deleted from the DB after verification; throwaway scripts (`scripts-tmp-*.ts`) removed, not committed.

## Failover

No tag/push for this stage's completion — `customer-master-v2-start` was tagged before changes per Step 0 above; pushing to `origin/main` is a separate explicit user request, not a default action here.
