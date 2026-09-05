# Stage 14c — Cost-working sheet

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Throwaway
per-role fetch verification against the running dev server passed (24/24), test rows
deleted afterward. Third of four Stage 14 sub-stages. Committed on branch
`stage-14c-cost-sheet` (off `stage-14b-quotation-pipeline`); **not pushed**.

## What was built

The **cost-working sheet** — a per-quotation internal costing surface that captures
vendor buy rates + margin per charge line. "Prepare Quotation" turns each line's
sell side into the customer-facing `QuotationLineItem` rows. Drives the
`FLOATED → COST_WORKING → QUOTATION_PREPARED` transitions from 14b.

### Schema (migration `20260906091000_stage_14c_cost_sheet`, 2 tables)
- **`QuotationCostSheet`** — 1:1 sidecar (`quotationId @unique`, `onDelete:
  Cascade`), `defaultMarginPct Float?`, `notes String?`, `preparedAt DateTime?`
  (stamped by `/prepare`), + `costLines`. `Quotation.costSheet` back-relation.
- **`QuotationCostLine`** — `category` (`QuotationChargeCategory`), `description`,
  `vendorName?`, buy side (`buyRate?`, `buyCurrency @default("INR")`,
  `buyExchangeRate?`, `buyRateInr?` computed), margin (`marginPct?`, `marginFlat?`,
  additive), `sellRate?` (computed, editable), `quantity?`, `amount @default(0)`,
  `sortOrder`. `@@index([costSheetId])`.
- Pure additive migration (no enum work — `QuotationChargeCategory` already exists),
  applied via the Neon adapter workaround.

### Margin math — `src/lib/quotations/cost-sheet-math.ts` (pure, no Prisma import)
- `computeBuyRateInr` — INR → `buyRate`; else `buyRate * buyExchangeRate` (null if
  either missing). Mirrors `LineItemsEditor.computeRateInr`.
- `computeSellRate` — **additive**: `(buyRateInr ?? 0) * (1 + (marginPct ??
  defaultMarginPct ?? 0)/100) + (marginFlat ?? 0)`; null only when both
  `buyRateInr` and `marginFlat` are null.
- `computeAmount` — `(quantity ?? 0) * (sellRate ?? 0)`.
- All three are recomputed **server-side** on every `PUT /cost-sheet` and on
  `/prepare`; the client editor recomputes locally too but a manual override of a
  computed field sticks until a dependency changes (same rule as
  `LineItemsEditor.updateItem`).

### Permissions — `src/lib/permissions/capabilities.ts`
New `CapabilityScreen` `"quotationCosts"` (no nav item — a card on the quotation
detail page; the `ports` / `enquiryFieldConfig` precedent): `ADMIN` /
`BRANCH_MANAGER` / `SALES` → `["view","edit"]`; `ACCOUNTS` → `["view"]`; `DOER` /
`CUSTOMER` → absent. Buy rates never reach the customer portal — `src/lib/portal/
queries.ts` carries a comment that the cost sheet is deliberately never selected.

### Routes (`src/app/api/quotations/[id]/`)
- **`cost-sheet/route.ts`**
  - `GET` — `can(role,"quotationCosts","view")` (403 for Doer/Customer). Returns
    `{ costSheet, costLines }` (`costSheet: null` when none).
  - `PUT` — `can(role,"quotationCosts","edit")`; `costSheetReplaceSchema`
    (`src/lib/validation/quotation.ts`). Allowed while `status ∈ {FLOATED,
    COST_WORKING, QUOTATION_PREPARED}`; **409 otherwise** (incl. `APPROVED` — the
    sheet has no version dimension and changes nothing customer-facing until
    `/prepare`, so cloning a version for an internal tweak would churn approval
    history). `$transaction`: upsert the sheet, `deleteMany` + `createMany` lines
    with server-recomputed `buyRateInr`/`sellRate`/`amount`; if the quotation was
    `FLOATED`, move it to `COST_WORKING`.
- **`prepare/route.ts`** — `can(role,"quotationCosts","edit")`. 409 if no sheet /
  zero cost lines, or status ∉ `{COST_WORKING, QUOTATION_PREPARED, APPROVED}`.
  Builds sell rows `{category, description, quantity, rate: sellRate,
  currency:"INR", exchangeRate:null, rateInr: sellRate, amount}`. From
  `COST_WORKING`/`QUOTATION_PREPARED` → replace the current version's line items in
  place; from `APPROVED` → clone `versionNumber + 1` (same rule as the line-items
  PUT) and reset to `QUOTATION_PREPARED`. Recomputes `QuotationVersion.totalAmount`;
  stamps `costSheet.preparedAt`. **Replace-all and re-runnable.**

### UI
- **`CostSheetEditor.tsx`** (new) — mirrors `LineItemsEditor.tsx` (per-category
  repeatable rows, `grid grid-cols-2 lg:flex` responsive layout, the
  recompute-unless-just-edited `updateLine`). Columns: Particulars · Vendor · Buy
  Rate · Buy Cur · Exch (currency ≠ INR) · Buy INR · Margin % · Margin Flat · Sell
  Rate · Qty · Amount · Remove. Sheet-level Default margin % + Notes above the
  grid; a footer **margin summary** (cost total = Σ buyRateInr·qty, quoted total =
  Σ amount, margin absolute + %).
- **`QuotationDetail.tsx`** — new props `canViewCosts` / `canEditCosts` /
  `costSheet` / `costSheetPreparedAt`. A **"Cost Working"** `Card` (only when
  `canViewCosts`, between the `StepTracker` and the Charges card): the
  `CostSheetEditor` with its own `useAutosave` PUT (`enabled` = `canEditCosts &&
  status ∈ {FLOATED,COST_WORKING,QUOTATION_PREPARED}`), a **"Prepare Quotation"**
  button (disabled with 0 cost lines) that on re-prepare (`costSheetPreparedAt`
  set) first shows an inline "Replaces all charge lines. Continue?" confirm, and a
  caption showing when charges were last generated.
- **`quotations/[id]/page.tsx`** — fetches the cost sheet (only when
  `canViewCosts`), computes the two caps, passes them down. The existing
  `key={quotation.id}-{currentVersionNumber}` remount already covers a `/prepare`
  clone bumping the version.

## Decisions / notes
- Separate 1:1 `QuotationCostSheet` table (not cost lines hung off `Quotation`) —
  house style; every sub-object in the schema is a 1:1 sidecar.
- `/prepare` re-run **replaces all** charge lines — guarded by the explicit button
  + `preparedAt`-based confirm + a "0 cost lines ⇒ 409" server check. No
  field-level merge (matches "replace children wholesale" everywhere else).
- Money stays `Float` (Stage 3 decision #7); `computeSellRate` results like
  `93300.00000000001` are expected IEEE-754 and rendered with `.toFixed(2)`.
- `cost-sheet-math.ts` is Prisma-free so `CostSheetEditor` ("use client") can
  import it — the 12c `next build` lesson.

## Verification (throwaway `tsx` fetch script, deleted, not committed)
Access: DOER + CUSTOMER `GET /cost-sheet` → 403; ACCOUNTS `GET` → 200, `PUT` → 403.
SALES `PUT /cost-sheet` (`defaultMarginPct:15`, a USD line
`buyRate:1000,xr:83,marginPct:10,marginFlat:2000,qty:1` + an INR line
`buyRate:5000,qty:2`) → server computes `buyRateInr` 83000, `sellRate` 93300
(=83000·1.1+2000), `amount` 93300; the no-own-margin line picks up the 15% default
→ `sellRate` 5750, `amount` 11500; `FLOATED → COST_WORKING`. `POST /prepare` → 200
`QUOTATION_PREPARED`, 2 line items generated (`rate` = `sellRate`),
`totalAmount` 104800, `preparedAt` stamped. Hand-edit a line item, re-`/prepare` →
replace-all restores the cost-sheet values. Approve → `/prepare` again → clones v2,
back to `QUOTATION_PREPARED`, v1 `approvedAt` intact. `PUT /cost-sheet` while
`APPROVED` → 409. Cost sheet + lines cascade-delete with the quotation. Pages
render.

## Failover
Two new additive tables + 3 new routes + a capability screen. No existing column
touched. Revert = drop the two tables and the changed files; `/convert` and Job
creation are unaffected (they only read the sell-side snapshot).
