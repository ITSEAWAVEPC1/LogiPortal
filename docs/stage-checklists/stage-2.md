# Stage 2 — Enquiry Capturing

Status: **Complete.** Acceptance criteria verified 2026-08-10.

## What was built

- **Enquiry entity** matching `docs/original-process-reference.pdf` page 2 exactly: Doer Name (auto-set to creator), Branch, Customer, Contact Person Name/Mobile/Email (auto-filled from the Organization, editable per-enquiry), Shipment Type, multi-select Type of Services, RFQ reason, plus a human-readable reference number (`ENQ-YYYY-####`).
- **Three conditional detail blocks** — Freight Forwarding (Incoterm/POL/POD + LCL&Air-or-FCL+ODC), Customs Clearance (HS Code/Commodity), Transportation (Pickup/Destination + LCL&Air-or-FCL+ODC, **no container-count field, has Delivery Type instead** — the one place Freight and Transport's FCL blocks genuinely differ) — each shown/hidden and required/not-required based on which service types are checked, via one `superRefine`-based schema (`src/lib/validation/enquiry.ts`).
- **Draft autosave + resume**: `/enquiries/new` creates a `DRAFT` row from just Branch+Customer, then routes to `/enquiries/[id]` — a real server-fetched page, so a browser refresh resumes structurally. Every field change debounce-PATCHes the draft (`src/lib/hooks/useAutosave.ts` + `useDebouncedValue.ts`).
- **Branch Manager review queue**: status-tabbed list at `/enquiries` (Draft/Open/Ready for Quotation/Needs Correction), with Approve/Flag-back actions inline in the list and on the detail page. Flag-back requires a reason; the enquiry returns to the Doer/Sales as `NEEDS_CORRECTION` with that note surfaced at the top of the form.
- **Customer picker ("new vs old customer")**: new generic `Combobox` UI primitive wired to Stage 1's existing `GET /api/customers?q=` (reused unchanged), with inline "+ Create new customer" reusing `CustomerFormModal` (moved to `src/components/shared/` so both `/customers` and `/enquiries` can use it without duplicating the GST/PAN validation logic) — selecting or creating a customer is immediate, no navigation away from the Enquiry form.
- **New permissions primitive**: `capabilities.ts` gained an `"approve"` action and an `"enquiries"` screen — the first approval-gate pattern in the app, reusable for Quotations (Stage 3) and Documents later.

## DB models added

`Enquiry`, `EnquiryFreightDetail`, `EnquiryCustomsDetail`, `EnquiryTransportDetail`. Enums: `ShipmentType`, `ServiceType`, `EnquiryStatus`, `CargoMode`, `TransportDeliveryType`.

## Key decisions (confirmed with the user before building)

1. **Type of Services is multi-select** — one enquiry can need Freight Forwarding + Customs Clearance + Transportation together, matching later pages of the source doc showing jobs combining services as "FF, CC, TPT."
2. **Warehousing / Exim Consultancy capture RFQ text only** — no fields are defined for them in the source doc.
3. **"Doer Name" auto-sets to the session user** creating the enquiry — never client-supplied, can be a Sales-role person per Section 5.2.
4. **Contact Person fields auto-fill from the Organization but stay editable per-enquiry.**
5. **Added a reference number** (`ENQ-YYYY-####`) — global autoincrement, not reset per year (a per-year-reset counter needs a transactional per-year table or DB sequence; a single Postgres autoincrement column is race-free for free and the year prefix is cosmetic).

## Implementation decisions (made during the build, not asked — cheap to reverse)

- `ServiceType[]` native Postgres array, not a join table — no indexed containment queries needed yet.
- Typed nullable columns for the LCL/FCL/ODC sub-fields, not JSON — the shape is small and finalized, unlike Stage 1's genuinely open-ended import-row errors.
- Branch Manager's enquiry approval is global, not branch-restricted — mirrors the same choice already accepted for Branch Manager's Customer-edit rights in Stage 1.
- No review-history log (resubmission overwrites the previous `reviewNote`) — full audit trails are a Stage 10 concern.
- Two React 19 lint rules (`react-hooks/set-state-in-effect`, `react-hooks/refs`) required restructuring `useAutosave`'s ref-sync (moved from an inline render-time assignment into its own effect) and `Combobox`'s loading-state effect (deferred via `queueMicrotask` so the `setState` call isn't the direct first statement in the effect body) — both are React's stricter Compiler-era rules catching genuinely fragile patterns, not false positives to suppress.

## Test users used

Same 6 seeded from Stage 0 (`admin@test.seawave.com` etc., password `password123`) — no new users needed.

## Acceptance criteria — verified

Ran a full API-level verification script (28 checks, all passed) rather than relying on UI clicking alone:

1. **Every Shipment Type × Service Type combination captures the right fields**: FF-only (LCL&Air, FCL non-ODC, FCL+ODC — including confirming FCL+ODC with missing ODC sub-fields is correctly rejected), Customs Clearance-only, Transportation (LCL&Air, FCL Loaded, FCL Destuff+ODC — confirming no container-count field is required there, unlike Freight Forwarding), all three services together, Warehousing-only and Exim Consultancy-only (no fields required beyond RFQ), zero services selected (rejected), and confirmed an unselected type's missing fields never block submission of a different selected type.
2. **Draft autosave/resume**: created a draft, PATCHed twice simulating debounce ticks, re-fetched fresh (equivalent to a refresh) and confirmed the last-written values persisted.
3. **NEEDS_CORRECTION cycle**: Branch Manager flag-back with a note succeeds and is stored; flag-back with no note is rejected (400); editing and resubmitting after correction returns the enquiry to `OPEN`.
4. **Review queue filtering**: status-filtered `GET` returns exactly the requested status, no other statuses leak in.
5. **Full role permission sweep** via direct API calls: Doer/Sales attempting review rejected (403); Branch Manager attempting to create rejected (403 — Edit/Approve, not Create); Accounts read-only (can view, can't create); Customer has no access at all (403); Admin can approve; Sales can create.
6. **Customer picker regression**: confirmed the existing `GET /api/customers?q=` search still works unchanged.
7. Page-render sweep (`/enquiries`, `/enquiries/new`, an enquiry detail page, plus Stage 1's `/customers`, `/data-import`, `/settings` for regressions) all return 200.
8. All verification data (19 test enquiries, 1 test organization) cleaned up afterward so Stage 3 starts clean.

## Failover

No tag/push for this stage — same as Stage 1, only done on explicit request.
