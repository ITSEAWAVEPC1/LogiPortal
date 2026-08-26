# Stage 3 — Quotation Module

Status: **Complete.** Acceptance criteria verified 2026-08-18 via a full direct-API run (see below).

## What was built

- **Quotation builder** (`/quotations/new`): Sales picks an Organization (reusing Stage 2's `CustomerCombobox`, promoted from `enquiries/_components/` to `src/components/shared/` so both screens use it unchanged) and bundles one or more of that org's `READY_FOR_QUOTATION` Enquiries into a single Quotation. **Enquiry↔Quotation is many-to-many, not 1:1** — a deliberate deviation from the literal Stage 3 prompt text, confirmed with the user before building: a Quotation can cover several shipments for one customer (one combined quote), and an Enquiry can only ever be attached to one Quotation (`QuotationEnquiry.enquiryId` is unique). Bundled enquiries must share both Organization and Branch (validated server-side, 400/404/409 with specific messages naming the offending enquiry).
- **Four charge-category line items** (Freight / Customs Clearance / Transportation / Reimbursement), each a repeatable add/edit/remove row (description/rate/quantity/amount/currency) rather than one flat amount per category — matches Section 2.3's "structured add/edit rows" data-entry philosophy. Autosaved via Stage 2's existing `useAutosave`/`useDebouncedValue` hooks, reused unchanged.
- **Branch Manager approval gate**: `PENDING_APPROVAL → APPROVED`, and a quotation cannot be marked `SENT` without first being `APPROVED` (409 otherwise) — the literal Section 5.3 requirement, verified directly.
- **Versioning**: while a version is unapproved (`DRAFT`/`NEEDS_CORRECTION`), line-item edits happen in place. Once approved (`APPROVED`/`SENT`/`CUSTOMER_APPROVED`), an edit clones the line items into a new `QuotationVersion`, resets `Quotation.status` to `DRAFT` for re-approval, and leaves the prior version's line items and `approvedBy`/`approvedAt` untouched — full history preserved, verified by editing a `SENT` quotation and confirming the old version's total was still intact afterward.
- **PDF generation** via `@react-pdf/renderer` (new dependency — pure-JS, no headless-browser binary, better fit than Puppeteer for Vercel serverless functions per the user's confirmed choice). `GET /api/quotations/[id]/pdf` streams real PDF bytes on success; on a render failure it returns `{fallback: true, data}` as JSON (200, not 500) so the client falls back to `QuotationHtmlPreview` — the same component that renders the exact same `QuotationPdfData` shape as plain HTML, so the failover path is real code, not a stub.
- **Convert to Job(s)**: `CUSTOMER_APPROVED → CONVERTED` writes one JSON `jobSnapshot` per attached Enquiry (not one blob on the Quotation, per the M:N decision below) onto each `QuotationEnquiry` row — Stage 4 will consume these to build one Job per Enquiry with zero re-entry.
- **Status-tabbed list** (`/quotations`) with inline Approve/Flag-back actions — direct reuse of Stage 2's `EnquiryList`/`ReviewModal` pattern.

## DB models added

`Quotation`, `QuotationEnquiry`, `QuotationVersion`, `QuotationLineItem`. Enums: `QuotationStatus`, `QuotationChargeCategory`. Migration `prisma/migrations/20260817200335_stage_3_quotation_module/` — no DROP/RENAME statements (verified). Back-relations added to `Branch`, `Organization`, `User`, `Enquiry` (all additive).

## Key decisions (confirmed with the user before building — both deviate from the literal Stage 3 prompt text, which assumed 1:1 Enquiry:Quotation)

1. **Enquiry↔Quotation is many-to-many.** A Sales user bundles one or more `READY_FOR_QUOTATION` Enquiries (typically same Organization — one customer, several shipments, one combined quote) into a single Quotation. Enforced: same Organization, same Branch, and an Enquiry can only ever be attached to one Quotation (DB-level unique constraint on `QuotationEnquiry.enquiryId`).
2. **Job conversion produces one JSON snapshot per Enquiry, not one blob on the Quotation.** Because a Quotation can bundle several Enquiries, "convert to Job" (Stage 4's concern to build the real Job) writes a snapshot onto each `QuotationEnquiry` row. Every enquiry in a bundle currently gets the quotation's **full** line-item set (no automatic per-shipment cost splitting — the source process document defines no attribution rule for a combined quote); flagged as an assumption for Stage 4 to confirm, same as prior stages' "assumptions flagged for a future task" pattern.
3. **Line items are repeatable rows per category**, not one flat amount per category — the source PDF's Quotation table literally shows 4 rows, but Section 2.3's stated design philosophy and how real freight quotes itemize sub-charges (Ocean Freight, THC, Documentation Fee, etc.) made the repeatable-row model the better fit; confirmed with the user before building.
4. **PDF library: `@react-pdf/renderer`** over Puppeteer+Chromium — confirmed with the user, better fit for Vercel serverless (no headless-browser binary, faster cold starts).
5. **`quotations` capability mirrors the Enquiry pattern exactly** (Section 4.2): Admin full; Branch Manager view/edit/approve; Sales view/create/edit; Doer/Accounts view-only (Accounts' "View charges" from Section 4.2 has no field-level nuance matrix the way Section 4.3 defines one for Jobs, so plain view-only at the whole-quotation level is the correct-scope default, not a gap); Customer no access — same deferred-to-Stage-9 reasoning as Organizations/Enquiries (`User.organizationId` row-scoping doesn't exist yet). `access-matrix.ts` needed no changes — `"quotations"` was already stubbed there since Stage 0.
6. **`GET /api/enquiries` extended (additive)** with optional `organizationId` and `unattached=true` query params so the Quotation builder can list an org's bundle-able enquiries — existing callers unaffected.
7. **Money fields stay `Float`**, consistent with the rest of the schema (no Decimal precedent anywhere yet, flagged in Customer Master v2 for a future revisit).
8. **IDs stay server-generated `cuid()`** — no reason to deviate from the schema-wide convention (Stage 1's client-generated-ID decision was specific to bulk-import's `createMany` batching, not a general pattern).

## Endpoints added

`POST/GET /api/quotations`, `GET /api/quotations/[id]`, `PUT /api/quotations/[id]/line-items`, `POST /api/quotations/[id]/{submit,review,send,customer-approval,convert}`, `GET /api/quotations/[id]/pdf`. All raised-timeout transactions (`{timeout: 20000, maxWait: 10000}`) follow Customer Master v2's precedent for nested multi-row writes (Quotation create, convert-to-Job).

## Verification

Full direct-API run (13 checks, all passed) via a throwaway `tsx` script authenticating each role through NextAuth's credentials flow — not UI clicking:

1. Bundle 2 same-org/same-branch enquiries → 201.
2. Re-attach an already-bundled enquiry → 404/409 as appropriate; bundle enquiries from different branches → 400.
3. Line items across all 4 categories → `totalAmount` matches the sum sent.
4. **`send` before approval → 409** — the core approval-gate acceptance criterion.
5. Submit → `PENDING_APPROVAL`; edit while pending → 409.
6. Doer/Accounts review attempt → 403; Branch Manager approve → 200, version's `approvedById`/`approvedAt` stamped.
7. `send` after approval → 200, `SENT`.
8. **Edit while `SENT` → new version created (v1→v2), status reset to `DRAFT`, v1's line items and total still intact** — the core versioning acceptance criterion.
9. Re-run submit → approve → send → customer-approval → `CUSTOMER_APPROVED`.
10. Convert → `CONVERTED`; both attached enquiries' `jobSnapshot` populated with `{quotation, organization, enquiry}`; further edits → 409 (fully locked).
11. Role sweep: Customer → 403 on list; Doer/Accounts → 200 view / 403 create; Admin full flow spot-checked.
12. PDF: real bytes returned, `Content-Type: application/pdf`, body starts `%PDF` (fallback path exists in code but wasn't naturally exercised — no render failure occurred).
13. `GET /api/enquiries?...&unattached=true` correctly excludes already-bundled enquiries.

`tsc --noEmit` and `npm run lint` both pass with zero errors. All verification data (test Organization, 4 Enquiries, 2 Quotations and their versions/line items) deleted afterward; throwaway scripts removed, not committed.

## Failover

Versioning preserves history (verified directly, not just in theory — see check 8 above). PDF failure falls back to HTML preview via a real shared-data-shape code path (`QuotationPdfData` → both `QuotationDocument` and `QuotationHtmlPreview` render it), not just a note in the plan. No tag/push for this stage's completion — same as Stages 1–2, pushing to `origin/main` is a separate explicit user request.
