# Stage 10c — Notifications (in-app centre + email-ready seam)

Status: **Complete.** `tsc --noEmit` + `eslint src` + `next build` clean; 8-check DB/logic
verification + 16-check per-role HTTP verification all passed against the running dev
server. Third of four Stage 10 sub-stages. Committed on branch `stage-10c-notifications`
(off `stage-10b-reports-cxo`); **not pushed**.

## What was built

### Schema (additive)
- **`Notification`** — one row is BOTH the in-app item and the email-outbox row:
  `{ id, userId, type NotificationType, title, body, linkPath?, data Json?, readAt?,
  emailStatus NotificationDeliveryStatus, emailAttempts, emailError?, nextAttemptAt?,
  emailSentAt?, createdAt, updatedAt }`. Indexes `[userId, readAt]`,
  `[emailStatus, nextAttemptAt]`, `[createdAt]`. FK to `users` is `RESTRICT` (append-
  oriented, like `JobAuditLog` / `PortalAccessLog`).
- **`NotificationPreference`** — `{ id, userId @unique, inAppEnabled, emailEnabled,
  mutedTypes Json[] (of NotificationType), createdAt, updatedAt }`, FK `onDelete: Cascade`.
- **`NotificationType`** enum — 16 values (workflow step submitted/approved/rejected, job
  workflow started, job completed, enquiry ready/needs-correction, quotation
  submitted/approved/needs-correction/sent/customer-approved, document
  submitted/approved/rejected/shared).
- **`NotificationDeliveryStatus`** enum — `PENDING | SENDING | SENT | FAILED | SKIPPED`.
- `User` back-relations `notifications` / `notificationPreference`.
- Migration `prisma/migrations/20260903180000_stage_10c_notifications/` (2× `CREATE TYPE`,
  2× `CREATE TABLE`, 4× `CREATE INDEX`, 2× `ADD CONSTRAINT`), applied via the Neon
  serverless-adapter + throwaway-`tsx` workaround, then `prisma generate` + dev restart.

### Delivery seam — email is dark by default
- **`src/lib/config/flags.ts`** — `notificationsEmailEnabled =
  NOTIFICATIONS_EMAIL_ENABLED === "true" && !!RESEND_API_KEY`. When off, `Notification`
  rows are still created (in-app), just `emailStatus = SKIPPED` and never dispatched.
- **`src/lib/notifications/mail/`** (modelled on `src/lib/pdf/document-storage.ts` — one
  swap point): `transport.ts` (interface), `log-transport.ts` (dev default — logs, never
  sends), `resend-transport.ts` (raw `fetch` against the Resend REST API — no `resend`
  npm dep), `index.ts` (`getMailTransport()` picks Resend vs Log by the flag;
  `__setMailTransportForTest()` stub seam like `pdfRenderer`), `templates.ts`
  (`renderEmail()` — brand HTML shell, every interpolated value HTML-escaped).
- `.env.example` gains `NOTIFICATIONS_EMAIL_ENABLED`, `RESEND_API_KEY`,
  `NOTIFICATIONS_FROM_EMAIL`, `CRON_SECRET`.

### Event pipeline
- **`src/lib/notifications/events.ts`** — 13 async builders (one per transition), each
  resolves recipients (`activeUsersWithRoleInBranch`, `customerUserIdsForOrg`), removes
  the actor, de-dupes, and composes `NotificationInput[]` (`{ userId, type, title, body,
  linkPath?, data? }`). CUSTOMER recipients get `/portal/...` links.
- **`src/lib/notifications/enqueue.ts`** — `enqueueNotifications(inputs)`: loads each
  recipient's `NotificationPreference`, skips muted types + `inAppEnabled === false`,
  sets `emailStatus` (`PENDING` only when `notificationsEmailEnabled` + `emailEnabled` +
  the user has an email, else `SKIPPED`), `createMany`. Whole body `try/catch → 0` —
  **never throws into the caller**.
- **`src/lib/notifications/dispatch.ts`** — `drainEmailQueue({ limit })`:
  **atomic claim** via a single `UPDATE "notifications" SET emailStatus='SENDING' WHERE id
  IN (SELECT id ... FOR UPDATE SKIP LOCKED) RETURNING id` (raw SQL — the earlier
  claim-then-reselect approach double-sent under true concurrency; this cannot), then per
  row: render + `getMailTransport().send()` → `SENT` / (retry `PENDING` +
  `nextAttemptAt = now + min(60, 2^attempts) min`, `FAILED` after 5). `reclaimStuckSending()`
  resets `SENDING` rows older than 10 min.
- **`src/lib/notifications/fire.ts`** — `fireAfterResponse(inputs)` wraps
  `after(async () => { enqueue; if created > 0 → drainEmailQueue({ limit: 10 }) })`
  (`after` from `next/server`, stable in Next 16.3). **Always called after the route's
  `$transaction` commits, never inside it.**
- **`src/lib/notifications/types.ts`** — `NOTIFICATION_TYPES` runtime array +
  `NOTIFICATION_TYPE_LABELS` (the generated enum is types-only), for zod + the prefs form.

### Hook sites (each fires after its transaction, before the JSON response)
| Route | Event(s) |
|---|---|
| `POST /api/jobs/[id]/workflow/steps/[stepId]` | `submit`→`WORKFLOW_STEP_SUBMITTED`; `approve`→`WORKFLOW_STEP_APPROVED`; `reject`→`WORKFLOW_STEP_REJECTED`; `complete` w/ `isFinal`→`JOB_COMPLETED` |
| `POST /api/jobs/[id]/review` | approve → `JOB_WORKFLOW_STARTED` |
| `PATCH /api/enquiries/[id]/review` | `ENQUIRY_READY` / `ENQUIRY_NEEDS_CORRECTION` |
| `POST /api/quotations/[id]/{submit,review,send,customer-approval}` | `QUOTATION_SUBMITTED` / `_APPROVED` / `_NEEDS_CORRECTION` / `_SENT` / `_CUSTOMER_APPROVED` |
| `POST /api/documents/[id]/{submit,review}` + `PATCH /api/documents/[id]` (share) | `DOCUMENT_SUBMITTED` / `_APPROVED` / `_REJECTED` / `_SHARED` (share fires only on a false→true `sharedWithCustomer` transition) |

Job/quotation/enquiry `findUnique` selects were widened as needed (branch/org/ref fields);
no response-shape change anywhere.

### API
| Method | Path | Gate |
|---|---|---|
| GET | `/api/notifications?filter=unread\|all&cursor=&countOnly=` | `auth()`; `userId = session.user.id` |
| PATCH | `/api/notifications/[id]` | `auth()`; own row (404 otherwise); `{ read }` → `readAt` |
| POST | `/api/notifications/mark-all-read` | `auth()`; caller's unread rows |
| GET / PUT | `/api/notifications/preferences` | `auth()` only; own row; `upsert` on `userId`; PUT validates `mutedTypes` against the enum |
| GET | `/api/cron/notifications` | `Authorization: Bearer ${CRON_SECRET}` **or** `?token=` (401 otherwise); no `auth()`; `reclaimStuckSending()` + `drainEmailQueue({ limit: 100 })`; `dynamic = "force-dynamic"` |

- **`vercel.json`** (new) — `crons: [{ path: "/api/cron/notifications", schedule: "*/5 * * * *" }]`.

### UI
- **`src/components/notifications/NotificationBell.tsx`** (`"use client"`) — shadcn
  `Popover` + `lucide` `Bell` + a plum unread badge. Opens → `GET ?filter=all`; item click
  → `PATCH {read:true}` then navigate to `linkPath`; "Mark all read"; "View all" →
  `/notifications` (hidden when `viewAllHref=""`). Badge refreshes via `?countOnly=1` on
  mount + `pathname` change (deferred with `queueMicrotask` per the repo's React-19
  set-state-in-effect pattern).
- **`src/components/layout/Topbar.tsx`** — the dead Bell icon button (10a) replaced with
  `<NotificationBell />`.
- **`src/app/(portal)/layout.tsx`** — `<NotificationBell viewAllHref="" />` in the
  sidebar footer (customer notifications already carry `/portal/...` links).
- **`/notifications`** — `src/app/(dashboard)/notifications/page.tsx` (`auth()` only) +
  `_components/NotificationList.tsx` (all/unread filter, cursor "Load more", mark read on
  click, mark-all-read).
- **`/settings/notifications`** — the 10a stub body replaced with
  `_components/NotificationPreferenceForm.tsx` (in-app / email channel toggles + a 16-row
  per-type mute checklist; `GET/PUT /api/notifications/preferences`; autosaves on change).
  `auth()`-only gate (all internal roles). A "Notification preferences" tile added to the
  Admin `/settings` grid; the Topbar user dropdown (10a) already links here for every role.

## DB models added

`Notification`, `NotificationPreference` + enums `NotificationType`,
`NotificationDeliveryStatus`. Two additive `User` back-relations. No existing column changed.

## Permissions

- **`access-matrix.ts`** — no change (no nav item; the bell lives in the Topbar).
- **`capabilities.ts`** — no change. Notification routes gate on "authenticated + own
  rows" (the `/api/preferences/[screenKey]` precedent). The cron route gates on
  `CRON_SECRET` only. `/notifications` and `/settings/notifications` gate on `auth()` alone.
- **`field-permissions.ts`** — no change.

## Key decisions

1. **In-app always on; email dark until configured** (user-confirmed). `notificationsEmailEnabled`
   needs both the switch and a Resend key; rows are otherwise `SKIPPED`.
2. **`after()` is primary, cron is the backstop.** Enqueue + a small drain run post-response;
   the every-5-min cron route drains the rest and reclaims stuck rows.
3. **Atomic claim via `FOR UPDATE SKIP LOCKED`** — the naive claim-then-reselect double-sent
   under concurrency (caught in verification); a single `UPDATE … RETURNING id` fixes it.
4. **Never inside a transaction.** `fireAfterResponse` is always called after the route's
   `$transaction` resolves; `enqueueNotifications` also swallows its own errors. A
   notification failure cannot block or roll back a workflow action (acceptance criterion).
5. **One `Notification` row = in-app item + email outbox** — no separate queue table.
6. **Raw Resend `fetch`, no `resend` npm dep** — same lean-dependency stance as the PDF module.

## Explicitly deferred

- **Audit-trail viewer** (`JobAuditLog` / `PortalAccessLog` / login log), security headers,
  OWASP route-auth sweep, perf pass, `/api/test/job-fields` removal — 10d.
- **A `/portal/notifications` full-history page** — the portal bell dropdown is enough for
  now; customer volume is low.
- **Digest / batching / quiet hours** — not in scope.
- **SMS** — explicitly out of scope for Stage 10.
- **Real Resend delivery** — needs a Resend account + `RESEND_API_KEY` at deploy time; the
  seam is complete and stub-tested.

## Verification

Two throwaway scripts (deleted, not committed):

**`_tmp_verify_10c_db.mts`** — pure pipeline, stub transport. **8 checks, all passed:**
- `enqueueNotifications` creates a row **only** for the un-muted, in-app-enabled recipient
  (muted type skipped, `inAppEnabled:false` skipped); the row is `SKIPPED` (email off in dev).
- `drainEmailQueue` with an ok stub → `SENT` + `emailSentAt`, exactly one `send()`.
- failing stub → `emailAttempts` advances, `FAILED` after 5 with `emailError` recorded.
- **race**: 3 concurrent `drainEmailQueue` over 6 rows → all `SENT`, **exactly 6 sends**
  (no double-send — this was the bug that drove the `FOR UPDATE SKIP LOCKED` rewrite).
- `reclaimStuckSending` resets a 20-min-old `SENDING` row to `PENDING`.

**`_tmp_verify_10c_http.mjs`** — per-role HTTP. **16 checks, all passed:**
- `/api/notifications` (`countOnly`, list shape) 200; anon → 401.
- preferences GET (defaults) / PUT (persists) / PUT with an unknown type → 400.
- cron: no bearer → 401, wrong bearer → 401, `Bearer <CRON_SECRET>` → 200 with
  `{ reclaimed, attempted, sent, failed }`.
- `/notifications` + `/settings/notifications` pages 200; DOER can reach
  `/settings/notifications` (no capability gate).
- **real transition**: BM `POST /api/jobs/[id]/review {approve}` → 200 and job →
  `WORKFLOW_IN_PROGRESS` (**transition committed**); ~1.5 s later a `JOB_WORKFLOW_STARTED`
  notification with `linkPath = /jobs/<id>` exists for the job creator (**`after()` fired,
  non-blocking**). `mark-all-read` → unread count 0.

`tsc --noEmit`, `eslint src`, `npx next build` (all routes compile) clean. Test-created
notification/preference rows for the seeded `@test.seawave.com` users were cleared
afterward. `CRON_SECRET` added to the local `.env` (gitignored; documented in `.env.example`).

## Failover

2 additive tables + 2 enums; no existing column changed. Email stays dark until the flag +
key are set — until then behaviour is in-app only. Disable email entirely by leaving the
flag off. `enqueueNotifications` and `fireAfterResponse` both swallow errors; `after()`
runs post-response, so nothing here can affect a core workflow action. Revert = drop branch
`stage-10c-notifications`; the two tables can stay unused or be dropped separately.
