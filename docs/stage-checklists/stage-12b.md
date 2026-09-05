# Stage 12b — Enquiry Workflow: Remove Approval Gate, Inline Edit, Toasts, Perf

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean;
API-level verification against the running dev server passed. Second of four
sub-stages addressing the stakeholder change-request batch — see
`docs/stage-checklists/stage-12a.md` for the first. **Not committed.**

## What was built

### Approval gate removed
- `PATCH /api/enquiries/[id]/submit` now transitions `DRAFT|NEEDS_CORRECTION
  → READY_FOR_QUOTATION` directly, instead of `→ OPEN` and waiting for a
  separate Branch Manager review call. `review/route.ts` and the
  `"approve"` capability are untouched in the backend (still callable
  directly) but now unreachable from the UI — nothing sets an enquiry to
  `OPEN` any more, so `review`'s `status !== "OPEN"` guard makes it a dead
  path in practice, confirmed by the verification script.
- `EnquiryList.tsx` and `EnquiryForm.tsx` lost their Approve/Flag-back
  buttons, the `canApprove` prop, and the `ReviewModal` usage. The now-unused
  `enquiries/_components/ReviewModal.tsx` was deleted (the Quotation
  module's own `ReviewModal.tsx` is a separate file, untouched).

### Combined submit — the "submit speed" work
- `EnquiryForm.tsx`'s old submit flow was two sequential round trips: a full
  autosave `PATCH` (persisting every field) immediately followed by a bare
  `PATCH .../submit` that re-fetched the same row from the DB just to
  validate it. New flow: `handleSubmit` posts the current form body straight
  to `/submit`, which persists it and performs the status transition in one
  transaction — one network round trip and one DB round trip instead of two
  of each.
- New shared helper `src/lib/enquiries/persist-draft.ts`
  (`persistEnquiryDraft`) factors the upsert-parent-then-replace-children
  logic (freight packages / commodity lines) out of `[id]/route.ts`'s PATCH
  so both the lenient autosave path and the strict submit path use the exact
  same write code — no duplicated transaction logic between the two routes.
- Since `enquirySubmitSchema` is a strict superset of the lenient autosave
  schema, `/submit` does a single `enquirySubmitSchema.safeParse(body)` and
  reuses `parsed.data` for both writing and validating — no second parse,
  no redundant DB read before the write.

### Edit-after-submit
- `[id]/route.ts`'s PATCH edit lock changed from "only DRAFT/NEEDS_CORRECTION
  for non-Admins" to "any status, unless already bundled into a Quotation"
  (`existing.quotationEnquiry` non-null → 409). This is the direct
  consequence of removing the approval gate: editability is now governed by
  whether a Quotation has been built from the enquiry, not by its status
  value.
- `EnquiryForm.tsx` takes a new `isLocked` prop (`enquiry.quotationEnquiry !==
  null`, computed in `[id]/page.tsx`) instead of the old
  `canEdit && (status === DRAFT/NEEDS_CORRECTION || role === ADMIN)` check —
  `editable = canEdit && !isLocked`.
- `EnquiryList.tsx` gained an inline edit icon (`lucide-react` `Pencil`,
  already a project dependency — first direct icon import in this list,
  replacing the earlier text-button-only convention for this screen) per
  row, shown when `canEdit && !row.quotationEnquiry`, navigating to
  `/enquiries/[id]`. Needed `quotationEnquiry: { select: { id: true } }`
  added to both the list and detail page's Prisma include.
- `EnquiryForm.tsx`'s action row now branches on whether the enquiry has
  ever been submitted (`status in [DRAFT, NEEDS_CORRECTION]`): unsubmitted →
  the original "Submit Enquiry" button; already submitted → "Back"
  (`router.back()`) and "Save & Close" (`saveDraft` + toast + redirect to
  `/enquiries`) buttons instead.

### Toasts
- `sonner` (installed in Stage 10a, `<Toaster />` already mounted, zero call
  sites anywhere in the app until now) is used for the first time:
  `toast.success("Enquiry submitted — ready for quotation")` on submit,
  `toast.success("Changes saved")` on Save & Close.

### List page default tab
- `/enquiries`'s default status tab changed from `OPEN` to
  `READY_FOR_QUOTATION`, since nothing new lands in `OPEN` any more (kept as
  a selectable tab for any pre-existing rows still sitting there).

## DB models / schema

**None.** Pure application-logic change — no migration.

## Endpoints changed

- `PATCH /api/enquiries/[id]/submit` — now accepts a request body (same
  shape as the autosave PATCH), persists it, and transitions straight to
  `READY_FOR_QUOTATION`. Previously took no body and only flipped status to
  `OPEN`.
- `PATCH /api/enquiries/[id]` — edit lock changed from status-based to
  Quotation-attachment-based (see above). Behavior otherwise unchanged.
- `PATCH /api/enquiries/[id]/review` — unchanged code, now practically
  unreachable (nothing produces `OPEN` status for it to act on).

## Key decisions

1. **Approval removed entirely, not made non-blocking** — confirmed with the
   user during Stage 1 planning: submitting now immediately makes an
   Enquiry `READY_FOR_QUOTATION`, no Branch Manager gate at all.
2. **Editability is Quotation-attachment-based, not status-based** — an
   Enquiry can be edited at any status right up until a Quotation has been
   built from it, matching the "edit in line of the listings" ask. This is a
   deliberate design choice, not explicitly spelled out in the original
   request: post-submission edits go through the lenient autosave PATCH
   (no re-validation), so it's possible to edit a `READY_FOR_QUOTATION`
   enquiry into an incomplete state (e.g. clear a required field) without
   the form itself blocking it — matches the "lightweight, no more approval
   gate" spirit of the request rather than reintroducing a stricter check.
3. **"Enquiry open table" (from the original request) interpreted as "the
   Enquiries list page,"** not literally the `OPEN` status tab — kept from
   the Stage 12a plan, since nothing lands in `OPEN` going forward.
4. **`review/route.ts` and the `"approve"` capability were left in the
   codebase rather than deleted** — callable directly, unreachable from any
   UI. (Confirmed as dead code by the verification script: calling it
   against a `READY_FOR_QUOTATION` enquiry returns 409.)

## Explicitly deferred (later sub-stages of this batch)

- Admin-configurable per-service-type field visibility/requiredness ("RFQ
  formatting") — **Stage 12c**, depends on Stage 12a's final field set.
- Quotation single-select, per-line currency, line-item additions,
  copy-to-email, version drill-down — **Stage 12d**, independent of 12a-12c.

## Verification

Throwaway scripts (deleted, not committed) against the running dev server,
NextAuth credentials login per role via raw `fetch` + manual cookie handling:

1. A single `/submit` call with no prior `PATCH` persists the full detail
   payload (one commodity line round-tripped via a follow-up GET) **and**
   transitions the enquiry straight to `READY_FOR_QUOTATION` — proving the
   combined write/validate/transition path actually works end to end, not
   just that it typechecks.
2. `PATCH /api/enquiries/[id]` succeeds against a `READY_FOR_QUOTATION`
   enquiry that isn't yet attached to a Quotation (edit-after-submit).
3. `PATCH /api/enquiries/[id]/review` against that same `READY_FOR_QUOTATION`
   enquiry returns 409 — confirms the dead-path claim, not just an assumption.
4. Creating a Quotation from the enquiry (as Sales, who holds the
   `quotations` `create` capability — Doer does not) then attempting another
   `PATCH /api/enquiries/[id]` returns 409 "converted to a Quotation."
5. Page-render sweep across Admin/Branch Manager/Doer/Sales:
   `/enquiries`, `/enquiries?status=OPEN`, `/enquiries?status=DRAFT`,
   `/enquiries/new` — all 200 except Branch Manager's `/enquiries/new`
   (307, pre-existing behavior — Branch Manager has never had the
   enquiries `create` capability, unrelated to this stage's changes).
6. All test rows (enquiry, quotation + its version/line items) deleted
   afterward via the same script.

Caught and fixed one lint miss from Stage 12a during this pass — an
unescaped apostrophe in the new Ports settings card copy
(`react/no-unescaped-entities`), missed because that file wasn't in 12a's
scoped lint command. `eslint src` (full project, not just changed paths) is
now the check used before calling a sub-stage done.

## Failover

Pure application-logic change (routes, components, one shared helper) — no
schema, no data migration. Revert = revert the changed files; the previous
approval-gated flow and its UI return unchanged (the deleted `ReviewModal.tsx`
would need restoring from git history if reverting this specific file).
