# Stage 14d — Copy-for-Email grouping + category rename

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Throwaway
fetch verification (rename reaches the PDF/portal; prepared-quotation pages render)
passed 4/4, test rows deleted. Fourth and final Stage 14 sub-stage. Committed on
branch `stage-14d-email-grouping` (off `stage-14c-cost-sheet`); **not pushed**.
Closes the Stage 14 batch.

## What changed

### 1. Charge-category label: "Freight Charges" → "Freight Booking Charges"
The `FREIGHT` enum value is unchanged — only the display label, everywhere it
shows:
- `src/lib/validation/quotation.ts` — `QUOTATION_CHARGE_CATEGORY_OPTIONS[0].label`
  (the line-items editor, the cost-sheet editor, and the portal quotation view all
  read this array, so they inherit it).
- `src/lib/pdf/QuotationDocument.tsx` — `CATEGORY_LABEL.FREIGHT`.
- `src/components/quotations/QuotationHtmlPreview.tsx` — `CATEGORY_LABEL.FREIGHT`.
- `src/lib/pdf/documents/InvoiceDocument.tsx` — `CATEGORY_LABEL.FREIGHT` (the
  Stage 7 invoice bills "As per Quotation" off the same category enum; renamed for
  consistency).

`grep -rn "Freight Charges" src` → nothing.

### 2. "Copy for Email" — grouped, lettered, numbered, full columns
`handleCopyForEmail` in `QuotationDetail.tsx` rewritten. Was a flat 8-column table
(Sr / Particulars / Currency / Qty / Rate / Rate INR / Remarks / Amount). Now:
- Line items grouped by charge category in canonical order (`FREIGHT →
  CUSTOMS_CLEARANCE → TRANSPORTATION → REIMBURSEMENT`), empty categories dropped.
- One section per non-empty category, headed `a) Freight Booking Charges`,
  `b) Customs Clearance Charges`, … (letters via `String.fromCharCode(97 + i)`).
- Items numbered `1. 2. 3.` within each section; each line shows **Particulars ·
  Qty · Rate · Amount** — `1. Ocean Freight   1 x 45000 = INR 45,000.00` (the
  `qty x rate =` prefix is dropped when either is blank).
- Emits **both** a plain-text outline and an HTML version (section header rows +
  right-aligned item rows + a grand-total `<tfoot>` row). Still writes both via
  `navigator.clipboard.write([new ClipboardItem({ "text/html", "text/plain" })])`
  with a `writeText(text)` fallback, `toast.success` / `setActionError`,
  `escapeHtml`.
- No schema / route / migration change.

## Decisions / notes
- The stakeholder mock (`a. Freight Booking Charges` / `1 2 3` / `b. Custom
  clearance`) is realised with `a)` / `b)` and the full category labels; item lines
  carry qty/rate/amount ("Full columns" per the settled answer), not just
  particulars.
- The generated Quotation PDF/HTML preview already grouped by category (Stage 3);
  only the FREIGHT label moved. Its 2-column description+amount layout is otherwise
  left as-is (Stage 12d decision #4 — a distinct redesign, out of scope).

## Verification (throwaway `tsx` fetch script, deleted, not committed)
Built a prepared quotation with FREIGHT + CUSTOMS_CLEARANCE cost lines → `/prepare`.
`GET /api/quotations/[id]/pdf` streams a PDF (or returns fallback data). The portal
quotation page HTML contains "Freight Booking Charges" and no bare "Freight
Charges". `/quotations/[id]` renders 200. (Copy-for-Email itself is a
client-clipboard action — the grouping/format is pure string logic covered by
`tsc` + the mock; not exercisable from a fetch script.) Test quotation / enquiry /
throwaway ports deleted afterward.

## Failover
Label-string swaps + one client function rewrite. No data, schema, or API surface
touched. Revert = restore the strings and the previous `handleCopyForEmail`.
