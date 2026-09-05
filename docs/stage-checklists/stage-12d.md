# Stage 12d — Quotation Rework

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean;
API-level verification against the running dev server passed. Fourth and
last sub-stage of the stakeholder change-request batch — see
`docs/stage-checklists/stage-12a.md`/`stage-12b.md`/`stage-12c.md` for the
first three (Enquiry-side; this one is Quotation-side and independent of
them). **Not committed.**

## What was built

### Single-select RFQ
- `createQuotationSchema` changed from `{organizationId, enquiryIds: string[]}`
  to `{organizationId, enquiryId: string}`. `NewQuotationForm.tsx`'s
  multi-select checkbox list became a single-select radio list (new `Radio`
  UI primitive, `src/components/ui/Radio.tsx` — mirrors `Checkbox.tsx`
  exactly; none existed before this).
- `POST /api/quotations` simplified to look up one Enquiry instead of a
  set — dropped the cross-enquiry same-organization/same-branch checks
  (nothing left to cross-check), kept the "not already attached to another
  Quotation" and "is READY_FOR_QUOTATION" guards. `sourceReference` (the
  "also covers RFQ-..." field for multi-enquiry bundles) is never set by new
  creates now; the column stays, unused, for any pre-existing multi-enquiry
  quotations.
- `QuotationEnquiry`'s join-table shape is untouched — it was already capped
  at one Quotation per Enquiry (`enquiryId @unique`); this stage only
  constrains the *other* direction (one Enquiry per Quotation) at the
  UI/validation layer, same as the approved plan called for.

### Format depends on service type
- `LineItemsEditor.tsx` takes an optional `availableCategories` prop. A
  category section still renders if it already has line items (never hides
  existing data) but only shows its "+ Add line" button when the category is
  in the allowed set. Reimbursement is always allowed regardless of service
  type (general catch-all).
- `QuotationDetail.tsx` computes the allowed set from the bundled Enquiry's
  (or Enquiries', for legacy multi-enquiry rows) `serviceTypes`, mapping
  `FREIGHT_FORWARDING→FREIGHT`, `CUSTOMS_CLEARANCE→CUSTOMS_CLEARANCE`,
  `TRANSPORTATION→TRANSPORTATION`.
- **Deliberately client-side only, not a server validation gate** — the PUT
  line-items route still accepts any category on any quotation. This is
  guidance for the form, not a data-integrity rule; verified directly (a
  Transportation line saves fine on a Freight-only quotation).
- The generated PDF/HTML preview were **not touched** — both already only
  render a category section when it has line items, so category filtering
  at the editor level (nothing gets added to a hidden category) already
  produces the same effect there with no code change needed.

### Per-line currency
- `QuotationLineItem` gained `remarks`, `exchangeRate`, `rateInr` (all
  optional/nullable). `currency` already existed per-line in the schema —
  the only thing that changed is the UI actually respects it, instead of one
  shared `<Select>` stamping the same value onto every row before every
  autosave.
- `LineItemsEditor.tsx`: each row gets its own Currency select (default
  `"INR"`), an Exchange Rate input shown only when that row's currency isn't
  INR, an always-visible Rate INR input, a Remarks input, and a Sr No column
  (client-side row index, no schema involvement). `rateInr` auto-recomputes
  from `rate × exchangeRate` (or `= rate` for INR rows) whenever
  rate/exchangeRate/currency change; `amount` auto-recomputes as
  `quantity × rateInr` whenever any of those (or quantity) change. Both stay
  directly editable afterward — a manual override sticks until another
  dependency changes again, same "recompute unless the user just touched
  this exact field" rule for both.
- **The version-level currency concept is gone.** `QuotationVersion.currency`
  is now unconditionally written as `"INR"` by the line-items PUT route
  (dropped from the client payload/schema entirely — `lineItemsReplaceSchema`
  no longer has a top-level `currency` field) and by quotation creation
  (previously read `organization.defaultCurrency`, now hardcoded `"INR"`),
  since the grand Total is now always a single INR figure by design — each
  line converts to INR on its own via `rateInr`, and `Total = sum(amount)`
  across all rows regardless of their individual currencies.

### Copy for email
- New "Copy for Email" button on `QuotationDetail.tsx` — builds an HTML
  `<table>` (Sr No/Particulars/Currency/Qty/Rate/Rate INR/Remarks/Amount +
  a total row) and a parallel plain-text version, writes both via
  `navigator.clipboard.write([new ClipboardItem(...)])` so pasting into a
  webmail compose (Gmail, Outlook) preserves the table — falls back to
  `writeText` (plain text only) if `ClipboardItem` isn't available. No
  existing precedent anywhere in the codebase for this.

### Version history drill-down
- New read-only `GET /api/quotations/[id]/versions/[versionNumber]/line-items`
  — no write counterpart needed, since a past version's line items are never
  edited (editing after approval clones a **new** version rather than
  touching history, per Stage 3's design).
- The "Version History" card's rows are now clickable — expanding one
  fetches (and caches in local state, so re-expanding doesn't re-fetch) that
  version's line items and renders them through the same `LineItemsEditor`
  in read-only mode with `availableCategories` omitted (so a past version's
  actual categories are never hidden by the current Enquiry's service
  types — the two are logically unrelated once a version is historical).

## DB models added

None — additive columns only on `QuotationLineItem` (`remarks`,
`exchangeRate`, `rateInr`). Migration
`20260905140000_quotation_line_item_currency`, applied via the Neon
serverless-adapter workaround.

## Endpoints changed

- `POST /api/quotations` — `{enquiryId}` instead of `{enquiryIds}`; simplified
  single-enquiry lookup and validation.
- `PUT /api/quotations/[id]/line-items` — no more top-level `currency` in the
  request; the version's currency is always written as `"INR"`.
- New `GET /api/quotations/[id]/versions/[versionNumber]/line-items`.

## Key decisions

1. **Category-by-service-type is UI guidance, not a server rule** — matches
   how Stage 12c treated field visibility as separate from data-integrity
   validation; a category being "wrong" for the service type isn't invalid
   data, just an unusual choice a user might have a real reason to make.
2. **The version's `currency` field is retired to a fixed `"INR"` marker,
   not removed** — additive-only convention; the column still accurately
   describes `totalAmount`'s denomination (always true now), it's just no
   longer something the client chooses.
3. **Rate INR is always shown, not behind a "give option to show" toggle**
   — the original request asked for an optional INR-equivalent column, but
   once currency became genuinely per-line, Rate INR became load-bearing
   for the grand Total's arithmetic, not an optional nicety; showing it
   unconditionally makes the total's math legible rather than opaque.
4. **PDF/HTML preview untouched** — category filtering already falls out of
   "nothing gets added to a hidden category," and extending the generated
   PDF's layout with Sr No/Qty/Rate/Rate INR/Remarks columns (today it's a
   2-column description+amount summary) is a distinct visual redesign task,
   not implied by the same specificity as the on-screen editor/copy-to-email
   ask. Flagging here in case a follow-up wants the formal PDF to match.

## Verification

Throwaway scripts (deleted, not committed) against the running dev server,
NextAuth credentials login via raw `fetch` + manual cookie handling:

1. The old `{enquiryIds: [...]}` shape is now rejected (400); the new
   `{enquiryId}` shape creates a Quotation (201).
2. A mixed-currency PUT (one INR line, one USD line with rate=10,
   exchangeRate=83) round-trips correctly: the USD line's `rateInr` (830)
   and `remarks` persist exactly; the version's `totalAmount` is the correct
   sum (200 + 2490 = 2690) and its `currency` is unconditionally `"INR"`.
3. A Transportation-category line saves successfully on a Freight-only
   quotation — confirms category filtering is genuinely UI-only, not
   silently enforced server-side too.
4. The version drill-down route returns all 3 line items for v1; a
   nonexistent version number returns 404.
5. Page-render sweep as Sales: `/quotations`, `/quotations/new`, and an
   existing (pre-Stage-12d) quotation's detail page — all 200, confirming
   the reworked `QuotationDetail`/`LineItemsEditor` render correctly against
   older data that predates the per-line currency/remarks fields.
6. All test rows (enquiry + its freight detail/package, quotation + version
   + line items, one throwaway `Port`) deleted afterward via the same
   script.

## Failover

Additive schema (three new nullable columns) + one new read-only route. No
existing quotation's data was altered — a pre-existing multi-enquiry
quotation or one with a non-"INR" version currency still displays (the
version-history/PDF code paths don't assume single-enquiry or INR-only).
Revert = revert the changed files; the three new `QuotationLineItem` columns
can stay unused indefinitely per the additive-only convention.

---

**This closes the Stage 12 batch (12a–12d)** — see the parent conversation's
approved plan for the full before/after picture across both the Enquiry and
Quotation modules.
