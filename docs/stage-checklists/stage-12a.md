# Stage 12a — Enquiry Field & Data Model Rework

Status: **Complete.** `tsc --noEmit`, `eslint`, `next build` all clean; API-level
verification against the running dev server passed. First of four sub-stages
addressing a batch of stakeholder change requests against the Enquiry and
Quotation modules — see the approved plan for the full 12a-12d breakdown.
**Not committed** (commits happen on explicit request only).

## What was built

### 12a1 — Customs Clearance: multiple HS codes/commodities
- New child table `EnquiryCommodityLine` (`hsCode`, `commodity`, `sortOrder`),
  one-to-many under `EnquiryCustomsDetail`. The old scalar `hsCode`/`commodity`
  columns on `EnquiryCustomsDetail` stay in the schema, unused (additive-only
  convention) — existing rows had blank test values in both, so no backfill
  was needed.
- `CustomsClearanceFields.tsx` rewritten as a repeatable-row editor ("+ Add
  commodity line" / Remove), same local-array pattern as
  `LineItemsEditor.tsx`/`ContainerDetailsEditor.tsx`.
- Submit validation: at least one commodity line required (each with both
  `hsCode` and `commodity` filled) when Customs Clearance is selected, replacing
  the old single-pair required check.

### 12a2 — Transportation: dimensions become L×W×H + unit, optional
- Additive `length`/`width`/`height` (`Float?`) + `dimensionUnit`
  (`DimensionUnit`: `MM`/`CM`) columns on `EnquiryTransportDetail`. The old
  `dimensions` free-text column stays, unused.
- `TransportationFields.tsx`'s single "Dimensions" text input replaced with
  Length/Width/Height number inputs + a Unit select.
- Submit validation: dimensions and weight are no longer required for the
  LCL & Air branch (only `packageCount` still is) — matches the approved
  plan's explicit scope (both relaxed, not just dimensions).

### 12a3 — Freight Forwarding: ports, destination address, LCL/FCL multi-package
- New `Port` model (`name`, `code?` unique, `isActive`) — admin-managed
  master list at `/settings/ports`, same CRUD shape as `BillType`/
  `BillTypeManager.tsx` (new `"ports"` capability, Admin-only create/edit/
  delete; `GET /api/ports` open to any role that can view Enquiries, same
  split as bill-types' GET route).
- `EnquiryFreightDetail.portOfLoading`/`portOfDischarge` (free text) stay,
  unused; new `portOfLoadingId`/`portOfDischargeId` FKs to `Port` added
  alongside. `FreightForwardingFields.tsx`'s two free-text port inputs became
  selects sourced from the `ports` list (threaded down from the `[id]/page.tsx`
  server component through `EnquiryForm`).
- New `finalDestinationAddress` (`String?`) field — only rendered in the UI
  when `incoterm` is `EXW`/`DDP`/`DDU`/`DAP`; never mandatory in validation
  either way (per the user's correction during planning — this is scoped to
  those four incoterms only, not "required for the others").
- New child table `EnquiryFreightPackage` (`length`/`width`/`height`/
  `dimensionUnit`, `weight`, `containerType`, `sortOrder`) replacing the flat
  `packageCount`/`dimensions`/`weight`/`fclWeight`/`containerType`/
  `containerCount` fields for new entries (old columns stay, unused).
  `containerType` was added to this table mid-build — it's not in the original
  plan text but dropping it would have been a real regression (FCL container
  type was a required field before). One "+ Add package"/"+ Add container"
  button (label follows cargo mode), dimensions/weight always optional, an
  inline running "Total weight" display. Submit validation: at least one
  package row required when a cargo mode is selected; no per-row requirement.

## DB models added

`Port`, `EnquiryCommodityLine`, `EnquiryFreightPackage`. Enum `DimensionUnit`
(`MM`, `CM`). Additive columns: `EnquiryFreightDetail.portOfLoadingId`/
`portOfDischargeId`/`finalDestinationAddress`; `EnquiryTransportDetail.length`/
`width`/`height`/`dimensionUnit`.

Migrations `20260905120000_enquiry_field_rework` and
`20260905121500_freight_package_container_type` (the second is the
`containerType` addition caught during the build) — applied via the Neon
serverless-adapter workaround (`[[prisma-migrate-neon-workaround]]`), same as
every prior migration on this machine.

## Endpoints changed

- `GET/PATCH /api/enquiries/[id]` — include now nests
  `freightDetail.packages` and `customsDetail.commodityLines`; PATCH's
  transaction does upsert-the-parent-row + delete-all/recreate-children for
  both arrays (same "replace children wholesale" pattern as the Quotation
  line-items PUT route), rather than spreading the array into the parent
  upsert (which Prisma would reject as a bad scalar).
- `PATCH /api/enquiries/[id]/submit` — same nested include added so
  `enquirySubmitSchema` re-validates against the DB's actual current state
  (unchanged "never trust the client" precedent).
- New `GET/POST /api/ports`, `PATCH /api/ports/[id]` — mirror `/api/bill-types`
  exactly, including the no-DELETE / soft-deactivate-only convention.

## Permissions

- `capabilities.ts` gained a `"ports"` screen: Admin-only
  `["view","create","edit","delete"]`. No other role has a `ports` entry —
  `GET /api/ports` instead falls back to the `"enquiries" view` check so every
  role that can see the Enquiry form can populate the port dropdowns.

## Key decisions (confirmed with the user before building)

1. Final Destination Address is scoped **only** to EXW/DDP/DDU/DAP (not shown
   for other incoterms), and never mandatory even then — corrected mid-review
   from an earlier draft that had it "required for other incoterms."
2. Port list is a new admin-managed master (not a static hardcoded dropdown).
3. Multi-package/"Add" treatment applies only to Freight Forwarding's LCL/FCL
   block, per the literal scope of the request — Transportation's LCL/FCL
   block only got the dimension-optionality change (still a flat 1:1 row, no
   repeatable packages).
4. Existing test/verification enquiry rows had blank `hsCode`/`commodity` and
   junk placeholder dimension values (e.g. `"111"`, `containerCount: 211`) —
   confirmed via a direct query before building, so no backfill migration was
   written; those old columns are simply left unused going forward.

## Explicitly deferred (later sub-stages of this batch)

- Removing the Enquiry approval gate, inline edit-after-submit, toasts,
  submit-speed work — **Stage 12b**.
- Admin-configurable per-service-type field visibility/requiredness ("RFQ
  formatting") — **Stage 12c**, depends on this stage's final field set.
- Quotation single-select, per-line currency, line-item field additions,
  copy-to-email, version drill-down — **Stage 12d**, independent of 12a-12c.

## Verification

Throwaway scripts (deleted, not committed) against the running dev server,
NextAuth credentials login per role via raw `fetch` + manual cookie handling:

1. Admin can create a `Port`; Doer gets 403 creating one but 200 listing one
   (dropdown-source access).
2. Freight: PATCH with 2 package rows (one with all dimensions null, one
   fully filled) round-trips correctly via GET, including `portOfLoadingId`
   and `finalDestinationAddress`; submit succeeds.
3. Freight: submit with cargo mode selected but zero package rows → 400,
   `"Add at least one package"`.
4. Customs: PATCH with 2 commodity lines round-trips via GET; submit
   succeeds.
5. Customs: submit with zero commodity lines → 400.
6. Transportation: submit succeeds with `packageCount` set but
   length/width/height/weight all `null` (proves the optionality change).
7. Page-render sweep as Admin: `/enquiries`, `/enquiries/new`, `/settings`,
   `/settings/ports`, `/settings/bill-types`, and an existing (pre-migration)
   Enquiry's detail page — all 200, confirming the new nested include doesn't
   break rendering old rows.
8. All test enquiries and the two test `Port` rows deleted afterward via the
   same script (Session login-audit rows from the two test logins were left
   in place — harmless, matches the app's own audit trail for every real
   login).

## Failover

Additive schema + two new UI/API surfaces (`/settings/ports`,
`/api/ports/*`). No existing column dropped or renamed. Revert = drop the two
new migrations' DDL and the changed files; no data was destructively altered.
