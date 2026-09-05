# Stage 12c — Enquiry Admin Field Configuration ("RFQ formatting")

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean;
API-level verification against the running dev server passed. Third of four
sub-stages addressing the stakeholder change-request batch — see
`docs/stage-checklists/stage-12a.md`/`stage-12b.md` for the first two.
**Not committed.**

## What was built

- New `EnquiryFieldConfig` model (`serviceType`, `fieldKey`, `isVisible`,
  `isRequired`, unique on `[serviceType, fieldKey]`). A missing row for a
  given key defaults to `{isVisible: true, isRequired: true}` — today's
  hardcoded behavior — so the table only needs a row once an admin actually
  changes something away from the default.
- **Split module**, required by the client/server boundary: the constant
  field-key list, types, and the pure requirement-checker function live in
  `src/lib/enquiries/field-config-keys.ts` (no Prisma import, safe to import
  from a `"use client"` component); the DB-backed `getEnquiryFieldConfigMap()`
  lives in `src/lib/enquiries/field-config.ts`, which re-exports everything
  from the keys file so existing server-side imports didn't need to change.
  (Caught during the build — importing the unsplit module from the admin
  settings manager component would have pulled the Neon Postgres adapter
  into the client bundle.)
- **Canonical configurable field-key list** (`ENQUIRY_FIELD_KEYS`) — a
  curated subset of the top-level fields per service type: Freight
  Forwarding's incoterm/portOfLoadingId/portOfDischargeId/cargoMode/packages;
  Customs Clearance's commodityLines; Transportation's
  pickup/destination/cargoMode/packageCount/containerType/deliveryType.
  Deliberately excludes `finalDestinationAddress` (its incoterm-conditional,
  never-mandatory rule is a fixed business rule from Stage 12a, not
  admin-tunable), the ODC sub-fields (already self-gated behind the `isOdc`
  checkbox), and per-line `hsCode`/`commodity` completeness (a structural
  rule — only "at least one line must exist" is configurable).
- **`enquirySubmitSchema`** (`src/lib/validation/enquiry.ts`) stripped down to
  structural checks only: a selected service type's detail object must
  exist, and its ODC sub-fields are required when `isOdc` is checked. Every
  per-field required check that used to be hardcoded there
  (Incoterm/ports/cargoMode/etc.) moved to
  `checkConfigurableFieldRequirements()`.
- **`PATCH /api/enquiries/[id]/submit`** now runs
  `checkConfigurableFieldRequirements(parsed.data, await getEnquiryFieldConfigMap())`
  after the Zod parse succeeds, returning the same `{error, issues}` 400
  shape as before if anything admin-configured-as-required is missing.
- **`isVisible:false` always wins over `isRequired`**, regardless of what's
  stored — `isEffectivelyRequired = cfg.isVisible && cfg.isRequired` is the
  single source of truth, so a hidden field can never block submission even
  if its `isRequired` flag was left `true` by mistake (verified directly).
- **New admin settings page** `/settings/enquiry-fields` +
  `EnquiryFieldConfigManager.tsx` — a fixed matrix (not a freeform CRUD list
  like Bill Types/Ports) grouped by service type, two checkboxes per field
  (Visible / Required), instant-upsert on toggle via
  `PATCH /api/enquiry-field-config`. The Required checkbox disables itself
  when Visible is off, matching the "hidden implies not required" rule.
- **`FreightForwardingFields.tsx`/`CustomsClearanceFields.tsx`/
  `TransportationFields.tsx`** each gained an optional `fieldConfig` prop
  (`Record<fieldKey, {isVisible, isRequired}>`, scoped to that component's own
  service type) and wrap their configurable fields in a `visible(key)` check.
  Customs Clearance's entire block is one configurable key
  (`commodityLines`) — the component returns `null` outright when hidden.
- **`EnquiryForm.tsx`** takes the full merged `fieldConfig` map as a prop
  (fetched server-side in `[id]/page.tsx` via `getEnquiryFieldConfigMap()`)
  and slices it per sub-component (`fieldConfig.FREIGHT_FORWARDING`, etc.).

## DB models added

`EnquiryFieldConfig`. No other schema change. Migration
`20260905130000_enquiry_field_config`, applied via the Neon
serverless-adapter workaround.

## Endpoints added / changed

- New `PATCH /api/enquiry-field-config` — upserts one `(serviceType,
  fieldKey)` override, Admin-only (`enquiryFieldConfig` capability). No GET
  route: every consumer that needs the merged config is a server component
  and calls `getEnquiryFieldConfigMap()` directly (the settings page, and
  `[id]/page.tsx`) — only the admin toggle write needed a client-callable
  endpoint.
- `PATCH /api/enquiries/[id]/submit` — now also runs the config-driven
  requirement check (see above).

## Permissions

- `capabilities.ts` gained `"enquiryFieldConfig"`: Admin-only
  `["view","edit"]`. Every other role's read access to the config is via the
  server-component direct-query path, not a capability check (there's no
  `GET` route to gate).

## Key decisions

1. **A curated, fixed field-key list, not a freeform admin-added list** — the
   set of fields that exist on the Enquiry form is fixed by the app's code
   (adding a genuinely new field is still a code change); admin only
   controls visibility/requiredness of that fixed set. This is why the
   settings page is a toggle matrix, not a Bill-Types-style
   create/edit/delete CRUD screen.
2. **Missing-row-means-default, not seed-on-migrate** — avoids needing to
   seed 12 rows on every environment; the table only grows as admins
   actually change something.
3. **`isVisible:false` unconditionally overrides `isRequired`** — a single
   choke point (`isEffectivelyRequired`) rather than trusting every call site
   (or the admin UI) to keep the two flags consistent.
4. **Structural checks (detail object existence, ODC sub-fields) stay
   hardcoded in the Zod schema, not folded into the config system** — they
   aren't part of the "which fields does the business want to require"
   question the admin surface is meant to answer; ODC in particular is
   already self-gated by its own checkbox.

## Explicitly deferred (last sub-stage of this batch)

- Quotation single-select, per-line currency, line-item additions,
  copy-to-email, version drill-down — **Stage 12d**, independent of
  12a-12c, no dependency on this stage's work.

## Verification

Throwaway scripts (deleted, not committed) against the running dev server,
NextAuth credentials login per role via raw `fetch` + manual cookie handling:

1. Sales (no `enquiryFieldConfig` capability) gets 403 on the PATCH endpoint;
   an unknown `fieldKey` is rejected with 400.
2. **Before any admin override**: submitting Freight Forwarding with no
   Incoterm/ports still fails with the same three issues as before this
   stage — confirms the refactor from hardcoded to config-driven didn't
   silently change default behavior.
3. Admin sets Incoterm to not-required: resubmitting the same still-DRAFT
   enquiry (same missing fields) now has exactly one fewer issue — the
   Incoterm one disappears, Port of Loading/Discharge (untouched) still
   block submission.
4. Admin hides Transportation's Pickup field (`isVisible:false`) while
   *leaving* `isRequired:true` — submitting with Pickup omitted still
   succeeds, proving the "visible wins" invariant isn't just a documented
   intention but actually enforced.
5. Both overrides reset back to `{isVisible:true, isRequired:true}` via the
   same PATCH endpoint afterward, and a follow-up direct DB read confirmed
   the reset took effect (not just that the calls returned 200).
6. Page-render sweep: Admin sees 200 on `/settings`, `/settings/enquiry-fields`,
   `/enquiries/new`; Doer gets the pre-existing 307 away from both `/settings`
   pages (Doer has never had the `settings` nav screen — unrelated to this
   stage) but still 200 on `/enquiries/new`.
7. `next build` (not just `tsc --noEmit`) was run specifically to catch the
   client/server bundling issue — `tsc` alone would not have caught a
   Prisma-in-client-bundle mistake, since the split-module fix is a runtime
   bundling concern, not a type error.

## Failover

Additive schema (one new table) + a new admin surface. No existing behavior
changes for any Enquiry that has no `EnquiryFieldConfig` override rows — the
default-required behavior is identical to pre-12c. Revert = drop the new
table/route/settings page and restore the hardcoded `enquirySubmitSchema`
checks from `stage-12b`'s version of that file.
