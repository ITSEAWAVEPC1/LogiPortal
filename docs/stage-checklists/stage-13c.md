# Stage 13c — Form/Grid Responsiveness Sweep

Status: **Complete.** `tsc --noEmit`, `eslint src`, `next build` all clean. Playwright-driven
browser verification (Job/Customer creation forms, an in-progress job's `WorkflowPanel`, a
quotation's `LineItemsEditor`, `ColumnPicker`) all passed at 375px with no horizontal
overflow and no console errors; desktop (1280px) confirmed byte-for-byte unchanged. Third of
four Stage 13 (Mobile Web Compatibility) sub-stages. Committed on branch
`stage-13c-forms-sweep` (off `stage-13b-table-cards`); **not pushed**.

## What was built

### Mechanical `grid-cols-N` → responsive, across 9 form files
Every multi-column form grid had **zero** responsive prefix — a fixed `grid-cols-3`/`-2`/`-4`
at every viewport width, badly cramped at 375px. Applied the same transform everywhere:
`grid grid-cols-N gap-3` → `grid grid-cols-1 gap-3 lg:grid-cols-N` (any other classes on the
div, e.g. `items-end`, `mt-3`, preserved as-is). Files: `JobForm.tsx` (6 grids: five 3-col,
one 2-col), `PartyFields.tsx`, `EnquiryForm.tsx`, `TransportationFields.tsx` (5 grids),
`FreightForwardingFields.tsx`, `GeneralSection.tsx`, `AccountInfoSection.tsx` (5 grids, two
with `items-end`), `BranchesSection.tsx`, `CustomerFormModal.tsx`.

### Breakpoint normalization
Two grids already had a responsive fallback but at the "wrong" (inconsistent) breakpoint —
normalized to `lg` so the whole app forks at exactly one width:
`ContainerDetailsEditor.tsx:57` (`sm:grid-cols-4` → `lg:grid-cols-4`) and
`WorkflowPanel.tsx:144` (`md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]` →
`lg:grid-cols-[...]`).

### `ColumnPicker` dual-list
`grid grid-cols-[1fr_auto_1fr] gap-4` → `grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]`
— Available Columns / move-buttons / Selected Columns now stack vertically on mobile instead
of squeezing three columns into ~340px. Automatically benefits from 13a's full-screen Modal
mode (verified: the two `size={10}` multi-selects get real vertical room).

### `LineItemsEditor` — per-line stacked grid
Row wrapper: `flex flex-wrap items-end gap-2 ...` → `grid grid-cols-2 gap-2 ... lg:flex
lg:flex-wrap lg:items-end lg:gap-2`. Every fixed-width utility (`w-24`, `w-20`, `w-28`)
prefixed with `lg:` so fields take their natural grid-cell width on mobile instead of a fixed
pixel width. The row index number and Remove button are rendered **twice** — once in a
`col-span-2 flex items-center justify-between lg:hidden` mobile header row, once inline at
their original position with `hidden lg:block`/`hidden lg:inline-flex` — rather than
restructured with CSS `order`, which would have needed an order value on every other field
too. Both instances call the same `removeItem(index)` handler; no dual state.

**Bug caught and fixed during verification**: `Particulars` and `Remarks` were meant to span
both grid columns on mobile (`col-span-2`), but a screenshot showed them still side-by-side
with their neighbor. Root cause: `col-span-2` was passed as the `<Input>`'s `className`,
which `Input.tsx` applies to the inner `<input>` element — not the outer `<div className="flex
flex-col gap-1">` wrapper that's the actual grid item. `col-span-*` on a non-grid-item element
two levels deep has no effect. Fixed by wrapping each of those two `<Input>`s in its own
`<div className="col-span-2 lg:contents">` — the wrapper is the grid item on mobile (spans
both columns), and unboxes itself via `display: contents` at `lg`+ so the `Input`'s own
wrapper becomes a direct flex-item child of the `lg:flex` row again, exactly matching the
original flat DOM structure. Verified with a before/after screenshot at both breakpoints.

### `StepTracker` — CSS-only vertical fallback for `horizontal` orientation
Only the `horizontal` orientation was broken on mobile (fixed-width steps compress and
collide rather than scroll, given 6–17 steps on some workflow templates). The `vertical`
orientation's `<ol>` was extracted into a `VerticalSteps` sub-component (unchanged markup).
`horizontal` now renders `<ol className="hidden w-full items-start lg:flex">...</ol>` (today's
markup, unchanged) followed by `<div className="lg:hidden"><VerticalSteps steps={steps}
/></div>` — both trees exist in the DOM at all times, toggled purely by breakpoint, matching
the DataTable/Modal pattern from 13a/13b. `vertical` orientation itself is untouched (already
mobile-safe) — now just calls `VerticalSteps` directly. Both real consumers
(`WorkflowPanel.tsx`, `ImportWizard.tsx`) get the fix automatically, no call-site changes —
purely additive to `StepTracker`'s internals, same external API.

## Files touched

`JobForm.tsx`, `PartyFields.tsx`, `EnquiryForm.tsx`, `TransportationFields.tsx`,
`FreightForwardingFields.tsx`, `GeneralSection.tsx`, `AccountInfoSection.tsx`,
`BranchesSection.tsx`, `CustomerFormModal.tsx`, `ContainerDetailsEditor.tsx`,
`WorkflowPanel.tsx`, `ColumnPicker.tsx`, `LineItemsEditor.tsx`, `StepTracker.tsx`.

## DB models added

None — pure UI/CSS.

## Endpoints added/changed

None.

## Permissions

None.

## Key decisions

1. **Grid collapse goes straight to 1 column, not an intermediate 2-column step** — a 3–4
   field row still cramps on a 700–900px window; single-column below `lg` avoids that
   in-between broken state, consistent with the single-breakpoint mandate for this stage.
2. **`StepTracker`'s two orientations rendered simultaneously (CSS-toggled), not
   conditionally mounted** — matches the CSS-dual-render convention established in 13a/13b,
   avoids any `matchMedia`/hydration risk.
3. **`LineItemsEditor`'s duplicated index/remove-button markup over a CSS `order` trick** —
   simpler to reason about and verify than reordering every sibling field, at the cost of two
   tiny render-twice JSX blocks (consistent with the DataTable/StepTracker dual-render
   precedent already established this stage).
4. **`display: contents` wrapper for `col-span-2` fields** — the only way to make a grid-item
   property apply to an `<Input>`/`<Select>` whose `className` prop lands on the inner
   control, not its wrapper, without changing those shared primitives' API.

## Explicitly deferred

- Nothing new; `DocumentHtmlPreview`/`QuotationHtmlPreview` (deliberately fixed-layout
  document mockups) and the already-responsive dashboard/reports/notification KPI grids were
  confirmed out of scope and left untouched, per the plan.

## Verification

Playwright (installed with `npm install --no-save playwright` for this pass only, using the
cached Chromium binary, uninstalled afterward) drove a headless Chromium against the running
dev server, logged in as `admin@test.seawave.com`, at 375×667 (and 1280×900 for comparison):

- `/customers/new` and `/jobs/new`: no horizontal overflow, fields stack one-per-row.
- A real job's detail page (`JobForm`): all "Routing & Vessel" fields stack correctly; header
  (title/badge, from 13b's fix) stacks cleanly above the form.
- Found a job with an attached 17-step Import Ex-Works workflow and confirmed
  programmatically: **0 visible** horizontal `StepTracker` labels at 375px (the vertical
  fallback's `<li>` **is** visible instead), and all 17 horizontal labels visible again at
  1280px — screenshotted both states, desktop matches the original horizontal tracker exactly.
- Found a quotation with a line item and screenshotted `LineItemsEditor` at both widths — this
  is where the `col-span-2` bug above was caught and then confirmed fixed: mobile now shows
  Particulars full-width, Currency/Qty/Rate/Rate INR paired two-per-row, Remarks full-width,
  Amount on its own; desktop is pixel-identical to the pre-Stage-13 layout.
- `ColumnPicker` ("Customize Columns" on `/customers`) screenshotted at 375px: Available
  Columns, move buttons, and Selected Columns stack vertically inside 13a's full-screen Modal,
  fully usable with real scroll room.
- Zero console/page errors from any of this stage's own changes. (One already-known,
  already-deferred hydration warning — `QuotationDetail.tsx`'s Version History date, one of
  the ~10 non-`DataTable` bare `toLocaleDateString()` sites explicitly left out of scope in
  13b's checklist — resurfaced when visiting a quotation detail page; not a regression from
  13c.)

`tsc --noEmit`, `eslint src`, `next build` all clean (all 59 routes compiled).

## Failover

Pure additive UI/CSS, no data/schema involved. Revert = drop branch
`stage-13c-forms-sweep`. No cleanup needed — verification touched no application data, and
the temporary Playwright package was uninstalled after use.
