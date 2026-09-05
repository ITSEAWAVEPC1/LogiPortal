# Stage 14a — Enquiry form cleanup

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Throwaway
per-role fetch verification against the running dev server passed (12/12 assertions),
test rows deleted afterward. First of four Stage 14 sub-stages. Committed on branch
`stage-14a-enquiry-cleanup` (off `main`); **not pushed**.

Stage 14 is a stakeholder change-request batch against the Enquiry and Quotation
modules (same shape as Stage 12). 14a is Enquiry-side form cleanup only.

## What was built

### Schema (migration `20260906090000_stage_14a_enquiry_fields`)
- `enum DimensionUnit` — appended `IN`, `FT`, `M` (was `MM`, `CM` only).
- `model EnquiryFreightPackage` — added `numberOfContainers Int?` (FCL: one row per
  container *type*, this many of them).
- Applied via the `[[prisma-migrate-neon-workaround]]` (hand-written `migration.sql`
  → `$executeRawUnsafe` per statement through the Neon adapter → recorded in
  `_prisma_migrations` → `prisma generate` → dev-server restart). Enum-add and the
  unrelated column-add share one migration safely — the SQL never *consumes* a new
  enum value, so Postgres' "unsafe use of new value" rule is not triggered.

### 1. Dead enquiry status tabs removed
`EnquiryList.tsx` `STATUS_TABS` — dropped `OPEN` and `NEEDS_CORRECTION` (dead since
Stage 12b removed the Branch-Manager approval gate; nothing transitions an enquiry
into either state). Now just `Draft` / `Ready for Quotation`. `enum EnquiryStatus`,
the row-type union, `STATUS_BADGE_VARIANT` (all 4 keys), and the `STATUS_VALUES`
parse allowlists in `enquiries/page.tsx` + `api/enquiries/route.ts` left intact so
a bookmarked `?status=OPEN` link still renders any legacy row.

### 2. Ex-Works "Pickup Address" relabel
`FreightForwardingFields.tsx` — the Final Destination Address input's label is now
`value.incoterm === "EXW" ? "Pickup Address" : "Final Destination Address"`. Same
`finalDestinationAddress` column, same `FINAL_DESTINATION_ADDRESS_INCOTERMS`
(EXW/DDP/DDU/DAP) visibility gate, still never mandatory. **No schema change** —
relabel only, per the settled decision.

### 3. Multiple dimension units
`IN`/`FT`/`M` added to `DIMENSION_UNIT_OPTIONS`, the two `z.enum([...])` occurrences
in `src/lib/validation/enquiry.ts` (`packageLenient`, `transportDetailLenient`), and
the `"" | "MM" | "CM"` unions in `FreightForwardingFields.tsx` /
`TransportationFields.tsx` / `EnquiryForm.tsx`'s raw types. No weight-unit and no
CBM field (deliberately out of scope).

### 4. FCL container fields (Freight Forwarding only)
`FreightForwardingFields.tsx` package rows now branch on cargo mode:
- **FCL** columns: Container Type · **No. of Containers** (`numberOfContainers`) ·
  Weight per Container (existing `weight`). L/W/H/Unit not rendered.
- **LCL & Air** columns unchanged: Length · Width · Height · Unit · Weight.

Still repeatable ("+ Add container" / "+ Add package"). `numberOfContainers` flows
through `FreightPackageState` → `EnquiryForm`'s `FreightPackageRaw` / `toFreightState`
/ `toAutosavePayload` → `persist-draft.ts`'s existing `...p` spread into the
`enquiryFreightPackage.createMany` (no persist-draft edit needed — the field rides
the spread; the Zod `packageLenient` gained `numberOfContainers: num`).
Transportation's FCL block is untouched (Stage 12a decision #3 kept it a flat 1:1
row with Delivery Type instead of a container count).

### 5. ODC removed entirely
- `FreightForwardingFields.tsx` + `TransportationFields.tsx` — the
  `Over-Dimensional Cargo (ODC)?` checkbox and its `odcDimensions` /
  `odcPackageCount` / `odcPerPackageWeight` sub-fields deleted; unused `Checkbox`
  import dropped from `TransportationFields`.
- `src/lib/validation/enquiry.ts` — `isOdc`/`odc*` removed from
  `freightDetailLenient` and `transportDetailLenient`; the two
  `enquirySubmitSchema.superRefine` `} else if (d.isOdc) { … }` bodies removed (the
  `if (!d)` "details are required" structural guards kept).
- `EnquiryForm.tsx` — ODC dropped from `FreightDetailRaw` / `TransportDetailRaw`,
  `toFreightState` / `toTransportState`, `toAutosavePayload`.
- **DB columns kept, unused** (`EnquiryFreightDetail`/`EnquiryTransportDetail`
  `isOdc @default(false)` + the three nullable `odc*`), per the additive-only
  convention. Verified: a PATCH still carrying a stale `isOdc:true` saves 200 and
  the DB `is_odc` stays `false` (Zod strips the unknown key).

### 6. "Labels once" — field labels as a single header row
The stakeholder complaint was the repetition of "HS Code" / "Commodity" (and the
package column labels) on every repeatable row.
- `CustomsClearanceFields.tsx` — one `hidden lg:flex` header row (`HS Code` /
  `Commodity`); each row's inputs lose `label=`, gain `aria-label=` + a
  `lg:hidden` inline label span so mobile still shows the field name.
- `FreightForwardingFields.tsx` — same treatment for the package/container rows,
  with a **cargo-mode-aware** header row (FCL vs LCL & Air have different columns).
  A small `renderCell` helper keeps the per-column input/select wiring in one place.
- `Input`/`Select` render fine with no `label`; column widths are driven by the
  wrapper `div` (`w-40`/`w-24`/…) with the control at `className="w-full"`.

## Decisions / notes
- Header rows are `hidden lg:flex`; below `lg` each field keeps a small inline
  `lg:hidden` label (the `flex flex-wrap` rows wrap on mobile, so one header row
  can't align to them). Matches the Stage 13 `lg` breakpoint convention.
- No change to `field-config-keys.ts` — `numberOfContainers` is always-visible like
  `weight`/`length`; ODC was already excluded from the configurable set (Stage 12c).
- `checkConfigurableFieldRequirements`'s "at least one package" rule is satisfied by
  container-only FCL rows (verified end-to-end).

## Verification (throwaway `tsx` fetch script, deleted, not committed)
As SALES against the running dev server: create enquiry → PATCH freight FCL with
`{containerType, numberOfContainers, weight}` rows + an LCL row with
`dimensionUnit:"FT"` → GET round-trips `numberOfContainers` (3, 1), `dimensionUnit`
`FT`, `finalDestinationAddress`; a stale `isOdc:true` in the payload is ignored
(no echo, DB `is_odc` false); `PATCH /submit` a Freight+FCL enquiry with
container-only rows (ports + incoterm set) → 200 `READY_FOR_QUOTATION`; page-render
sweep of `/enquiries`, `/enquiries/new`, the detail page → all 200. Test enquiry +
two throwaway `Port` rows deleted afterward; `Session` login rows left in place.

## Failover
Purely additive schema (one enum add, one nullable column) + form/validation
changes. No column dropped or renamed. Revert = drop the new migration's DDL and
the changed files; no data destructively altered. ODC / legacy status data is
untouched and still readable.
