# Stage 5 — Import Workflow Engine (Ex-Works & FOB tracks)

Status: **Complete.** Acceptance criteria verified 2026-09-01 via a full direct-API run (52 checks, all passed) + page-render + admin-gating smoke.

## What was built

- **Configurable workflow engine** — templates are data (`WorkflowTemplate` + `WorkflowStep`), not code. When a Branch Manager approves a Job (`POST /api/jobs/[id]/review`, approve branch), the active steps of the `WorkflowTemplate` matching `(shipmentType, normalizeIncotermKey(incoterm))` are copied into `JobWorkflowProgress` rows — lowest `sortOrder` `IN_PROGRESS`, the rest `PENDING` — plus a `workflow.attached` audit row, all in the same `$transaction` as the status flip. `src/lib/workflow/engine.ts` (`attachWorkflow` + pure sequencing helpers), step data in `src/lib/workflow/import-tracks.ts`.
- **Ex-Works track (17 steps) & FOB track (16 steps)** per `docs/original-process-reference.pdf` pages 3-4 / plan §5.5-5.6, seeded from `import-tracks.ts` by `prisma/seed.ts`. FOB is Ex-Works minus `container_pickup_date` (derived by filter so the shared steps never drift). Step ownership: DOER for all but `freight_certificate_prep` + `bill_preparation` (ACCOUNTS). The one two-actor gate is `draft_hbl_approval` (owner DOER → approver BRANCH_MANAGER).
- **Per-step state machine** (`POST /api/jobs/[id]/workflow/steps/[stepId]`, body `{ action, data?, note? }`):
  - `save` — lenient partial write of step `data`, promotes `PENDING`→`IN_PROGRESS`.
  - `complete` — strict per-step field validation, `→ COMPLETED`, promotes the next `PENDING` step, and (for `delivered_status`) flips `Job.status → COMPLETED` + a `job.completed` audit row.
  - `submit` — gate steps only: `→ PENDING_APPROVAL`.
  - `approve` / `reject` — gate steps only: `→ COMPLETED` (+ promote next) / `→ IN_PROGRESS` (+ `reviewNote`, note required).
  - `revert` — ADMIN only: a `COMPLETED` step `→ IN_PROGRESS`, every later step `→ PENDING`, and a `COMPLETED` Job back to `WORKFLOW_IN_PROGRESS`. Note required.
  - Ordering guard: an action is refused (409) unless every earlier active step is `COMPLETED`.
- **Append-only `JobAuditLog`** — every mutating step action writes exactly one row inside the same transaction (`workflow.attached` / `workflow.step.{submitted,completed,approved,rejected,reverted}` / `job.completed`). No `updatedAt`, and **no PATCH/DELETE route** for it anywhere (verified by grep).
- **Two-pane Job detail** (`/jobs/[id]`, plan §2.2): for a `WORKFLOW_IN_PROGRESS`/`COMPLETED` Job the page becomes `JobForm` (left) + `WorkflowPanel` (right, `xl` breakpoint). `WorkflowPanel` self-fetches `GET /api/jobs/[id]/workflow` and composes `src/components/workflow/{WorkflowRail,StepDetailCard,AuditTrail}.tsx`. Reuses the `StepTracker` primitive (horizontal) for the summary ribbon; `WorkflowRail` is the interactive vertical rail (a feature composite in the plan's designated `components/workflow/` dir, not a second generic primitive). `StepDetailCard` renders each step's fields from `WORKFLOW_STEP_FIELDS` and shows only the action buttons the viewer's role + the step's status allow.
- **Admin template screen** (`/settings/workflow-templates`, Admin only, mirrors `settings/bill-types`): per template — rename, activate/deactivate, and per step — reorder (↑/↓), rename, change owner role, toggle the approval gate (= set/clear approver role), deactivate, add a new step. `PATCH /api/workflow-templates/[id]` applies the `steps[]` array **by diff** (match on `id` → update in place; no `id` → insert; omitted → untouched; no delete — `isActive:false`), because `JobWorkflowProgress.stepId` FKs those rows.

## DB models added

`WorkflowTemplate`, `WorkflowStep`, `JobWorkflowProgress`, `JobAuditLog`. Enum: `WorkflowStepStatus` (`PENDING`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, `SKIPPED` — `SKIPPED` reserved for Stage 6 "if required" steps, unused by Import). Additive back-relations: `Job.workflowProgress`/`auditLogs`, `User.workflowStepsCompleted`/`workflowStepsApproved`/`jobAuditLogs`. Migration `prisma/migrations/20260901124533_stage_5_import_workflow_engine/` — 20 statements, all `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT` (verified, no DROP/RENAME/ALTER COLUMN).

`JobWorkflowProgress` **denormalizes** `stepKey`/`label`/`sortOrder` at attach time — an admin template edit afterward changes nothing for in-flight Jobs (verified). `ownerRole`/`approverRole`/`isApprovalGate` are read live from the related `WorkflowStep` (so an owner-role correction does reach in-flight Jobs — deliberate, that's what "corrections" means).

## Endpoints added

- `GET /api/jobs/[id]/workflow` — `jobs:view` + `workflowStatus` field access ≠ `NONE`. Returns `{ attached, job, template, progress[], auditLog[], currentStepId, viewerRole, canManageTemplates }`. Freight-Certificate steps with no saved data get `shipperName`/`consigneeName`/`portOfLoading`/`portOfDischarge` prefilled from the Job.
- `POST /api/jobs/[id]/workflow/steps/[stepId]` — the state machine above. Authorization is **per-step** (`ownerRole`/`approverRole`/ADMIN), deliberately independent of the coarse `workflowStatus` field-group perm, which only governs whether the tracker is visible (mirrors Stage 4's Accounts pattern). All writes `$transaction(..., { timeout: 20000, maxWait: 10000 })`.
- `GET /api/workflow-templates`, `GET /api/workflow-templates/[id]`, `PATCH /api/workflow-templates/[id]` — new `workflowTemplates` capability, `ADMIN: ["view","edit"]` only. **No POST** (decision #4 — the screen edits seeded templates, it doesn't create from scratch; Stage 6 seeds the Export ones).

## Endpoints changed (additive, not breaking)

- `POST /api/jobs/[id]/review` — the `approve` branch now runs inside a `$transaction` and calls `attachWorkflow(tx, job, actorId)` after the status flip. `needs_correction` unchanged. Response gains `workflow: { attached, reason?, templateName?, stepCount? }`.

## Permissions

- **`capabilities.ts`** — added `"workflowTemplates"` to `CapabilityScreen`; `ADMIN: ["view","edit"]`, no key for any other role.
- **`access-matrix.ts`, `field-permissions.ts`, `prisma/seed.ts` FieldPermission rows** — **no changes.** `workflowStatus` was already seeded for all 6 roles (Admin/BM/Doer EDIT, Sales/Accounts/Customer VIEW) and now means "can see the tracker". Per-step *actions* are gated on `WorkflowStep.ownerRole`/`approverRole` in the route. The `/settings/workflow-templates` page lives under the existing Admin-visible `settings` nav item (like `bill-types`), so no nav-matrix change.
- No DELETE verb anywhere. Step removal = `PATCH` step `{ isActive:false }`. `JobAuditLog` has no mutation route at all.

## Key decisions (confirmed with the user before building)

1. **Non-EXW/FOB Import Jobs** (Incoterm CIF/DDP/DDU/blank/other): approval still succeeds, **no template attaches** (`attachWorkflow` returns `{ attached:false, reason:"no-template" }`), the panel shows a "no workflow steps attached" note. Stage 6+ adds the other tracks. Approval is never blocked on Incoterm.
2. **Freight Certificate Preparation is an Accounts-owned single step** — Accounts fills the 9 figures and completes it directly, no separate approver. The only two-actor gate is Draft HBL.
3. **Existing `WORKFLOW_IN_PROGRESS` Jobs: new approvals only.** No backfill, no lazy attach — workflow rows are created solely in the review approve branch. A Job that predates Stage 5 (or has a non-EXW/FOB Incoterm) shows the empty-state panel. Verified: a status-only `WORKFLOW_IN_PROGRESS` Job with zero progress rows returns `attached:false`, no crash.
4. **Admin screen edits the seeded templates** — reorder / rename / add / deactivate steps, toggle gate, change owner/approver role, activate/deactivate template. No create-from-scratch.

## Implementation decisions (made during the build, cheap to reverse)

- **`isApprovalGate` is kept coherent with `approverRole` server-side** — a step is a gate iff it has an approver. The admin UI's "requires approval" checkbox just sets/clears the approver (defaulting to `BRANCH_MANAGER`); the PATCH route forces `isApprovalGate = Boolean(approverRole)` regardless of what the client sends, so the two can't drift.
- **Per-step field validation is hand-rolled** (`validateStepData` in `src/lib/validation/workflow.ts`), not zod — the schema is per-`stepKey` dynamic and the shape is flat key/value, same precedent as the bulk-import row validators. `WORKFLOW_STEP_FIELDS` (the field list per step) drives both server validation and the `StepDetailCard` form. Steps not listed there use `[date, note]`.
- **`submit` requires strict data too** (not just `complete`) — the Doer hands Draft HBL to the BM with the draft date filled, not blank.
- **Completing `delivered_status` auto-completes the Job** (`Job.status → COMPLETED`); the "final notification to Sales and Accounts" from §5.5 step 17 is deferred to Stage 10 (notifications). `revert` on any step of a `COMPLETED` Job reopens it to `WORKFLOW_IN_PROGRESS`.
- **`normalizeIncotermKey`** = `incoterm.trim().toUpperCase()`. `Job.incoterm` stays free-text; the template match is on the uppercased value against `WorkflowTemplate.incotermKey` (`"EXW"` / `"FOB"`).
- **`WorkflowPanel` derives its selected step during render** (no `set-state-in-effect`), and its mount fetch is wrapped in `queueMicrotask` — same React 19 lint pattern as Stage 2's Combobox/useAutosave.
- The Stage 5 prompt's `src/app/(dashboard)/jobs/import` path hint is stale (that's Stage 4's bulk importer); the tracker went on the Job detail page per §2.2.

## Explicitly deferred (per plan scope)

- **Export tracks** (CIF/DDP/DDU, Dock/Factory Stuffing, duty-payment landed-cost visibility) — Stage 6, reusing `WorkflowTemplate`/`WorkflowStep`/`JobWorkflowProgress`/`JobAuditLog` and the engine unchanged. The `SKIPPED` status and Export template seeding land there.
- **Document uploads within steps** (Draft HBL file, MBL Copy, DO) — Stage 7. Steps capture text fields only; the `documents` field group stays permission-only.
- **Notifications** on `delivered_status` / gate events — Stage 10 (queued, non-blocking).
- **Field-level Job-form diffing into `JobAuditLog`** — Stage 10's audit-trail viewer. Stage 5 writes only workflow-step + `job.completed` events.
- **Customer-scoped tracker** ("their job's tracker only", §4.3) — Stage 9 (`User.organizationId`). Customer has no `jobs` capability yet, so the Job detail page still redirects them.
- **"Create new template from scratch" / clone** in the admin screen — not needed until a track type appears outside the seed.
- **Live map** for Transportation jobs (§2.2) — no mapping integration.

## Verification

Full direct-API run via a throwaway `tsx` script authenticating each role through the NextAuth credentials flow (52 checks, all passed):

1. **Attach on approve** — EXW Job → 17 `JobWorkflowProgress` rows, sorted, first `IN_PROGRESS` rest `PENDING`, one `workflow.attached` audit, template `Import — Ex-Works`. FOB → 16 rows, no `container_pickup_date`. CIF → approve succeeds, **0** rows, `attached:false`.
2. **Ordering guard** — completing `handover_at_port` before `draft_hbl_approval` → 409.
3. **Two-actor gate** — Doer `submit` → `PENDING_APPROVAL`; Doer/Sales `approve` → 403; BM `reject` no note → 400; BM `reject` + note → `IN_PROGRESS` + `reviewNote` + `workflow.step.rejected` audit; re-`submit` → BM `approve` → `COMPLETED` + `approvedById` set + next step `IN_PROGRESS`.
4. **Role-owned steps** — Doer `complete` `freight_certificate_prep` → 403; Accounts → 200, all 9 fields persisted; Doer `complete` `bill_preparation` → 403, Accounts → 200; Accounts `complete` a DOER step → 403.
5. **Strict field validation** — `onboard_hbl_details` missing `hblDate` → 400 with `issues[]`; both fields → 200.
6. **Final step → Job COMPLETED** — completing `delivered_status` → `jobCompleted:true`, `Job.status` `COMPLETED`, `job.completed` audit row.
7. **Revert** — Doer `revert` → 403; Admin `revert` a completed step → that step `IN_PROGRESS`, later steps `PENDING`, `workflow.step.reverted` audit, Job stays `WORKFLOW_IN_PROGRESS`; `revert` from a `COMPLETED` Job → `jobReopened:true`, Job back to `WORKFLOW_IN_PROGRESS`.
8. **Audit append-only & ordered** — GET returns rows in `createdAt` order, DB count matches, no mutation route exists.
9. **Admin template edit** — non-admin `PATCH` → 403; Admin `PATCH` (swap first two steps' order, rename one, turn `handover_at_port` into a gate) → 200; a **new** EXW Job reflects all three changes; an **in-flight** EXW Job is unchanged (still `ETD from POL` at index 0); template then restored to original exactly.
10. **Pre-Stage-5 Job** — a status-only `WORKFLOW_IN_PROGRESS` Job with no progress rows → `GET .../workflow` 200, `attached:false`, panel empty-state, no crash.

Also: `/settings`, `/settings/workflow-templates` (both templates render), `/settings/bill-types`, `/jobs`, `/enquiries` all 200 as Admin; Sales → 307 to `/settings` on the admin screen and 403 on `GET /api/workflow-templates`; two-pane layout renders only for `WORKFLOW_IN_PROGRESS`/`COMPLETED` Jobs, not `DRAFT`.

`npx prisma migrate dev` applied cleanly against Neon; `npm run db:seed` is idempotent (ran twice — 2 templates, 17+16 steps stable). `tsc --noEmit` and `eslint src prisma` both pass with zero errors. All `ZZZ`-prefixed test data + workflow/audit rows deleted afterward; the 2 seeded templates and pre-existing dev data (`Test Exports Pvt Ltd` + its 4 enquiries / 1 quotation / 1 pre-existing DRAFT job created via the UI earlier today) left untouched. Throwaway scripts removed, not committed.

## Failover

Workflow templates are data — corrections go through `/settings/workflow-templates`, no deploy (verified: reorder/rename/gate-toggle via `PATCH`, in-flight Jobs unaffected). The audit log is append-only. No tag/push for this stage's completion — same as Stages 1–4, pushing to `origin/main` is a separate explicit user request.
