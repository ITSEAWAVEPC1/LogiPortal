# Stage 10d — Audit-trail Viewer + Performance / Security Hardening

Status: **Complete.** `tsc --noEmit` + `eslint src` + `next build` clean; 41-check per-role
HTTP verification all passed against the running dev server with `prisma/seed-demo.ts`
loaded. Fourth and final Stage 10 sub-stage. Committed on branch
`stage-10d-audit-hardening` (off `stage-10c-notifications`); **not pushed**.

**PITR restore point (recorded before any hardening change):** `2026-09-03T14:43:29Z`
(Neon keeps continuous point-in-time history; restore to just before this timestamp to undo
10d if needed).

## What was built

### Audit-trail viewer
- **`access-matrix.ts`** — new `"audit"` `ScreenKey` + `NAV_ITEMS` entry
  (`/audit`, "Audit Trail") + `SCREEN_ACCESS` for **ADMIN and BRANCH_MANAGER only**.
- **`src/lib/audit/labels.ts`** (new) — `JOB_AUDIT_ACTION_LABEL` / `JOB_AUDIT_ACTIONS` /
  `jobAuditActionLabel` / `jobAuditNote` extracted from
  `src/components/workflow/AuditTrail.tsx` (which now imports them — the per-job panel and
  the global viewer share one phrasing), plus `PORTAL_ACCESS_OUTCOME_LABEL`.
- **`src/lib/audit/queries.ts`** (new) — cursor-paginated (`(createdAt desc, id desc)`,
  200-row cap):
  - `getJobAuditPage(scope, { actorId?, action?, from?, to?, branchId?, cursor?, limit? })`
    — `JobAuditLog` + `actor { name, role }` + `job { referenceNo, sequenceNumber, branch }`.
    Branch filter goes through `job.branchId`; `scope` (via `reportScope`) forces a
    BRANCH_MANAGER to their own branch and `resolveReportBranchIds` fail-closes a
    cross-branch `?branchId=` to `NO_BRANCH`.
  - `getPortalAccessPage(...)` — `PortalAccessLog` + `user { email }` (ADMIN pages only).
  - `getLoginAuditPage(...)` — `Session` + `user { email, name, role }` (ADMIN pages only).
  - `getAuditActors()` — the actor-filter option list.
- **`src/lib/audit/csv.ts`** (new) — `jobAuditToCsv` / `portalAccessToCsv` /
  `loginAuditToCsv` → `(headers, string[][])` for `rowsToCsv`.
- **`src/app/(dashboard)/audit/page.tsx`** (new, server component) — `auth()` +
  `canAccessScreen(role, "audit")` else `redirect("/")`. URL-driven tabs (`?tab=job|portal|login`)
  rendered as `<Link>` pills (job always; portal + login **ADMIN only** — a BM forcing
  `?tab=login` silently falls back to the job tab). `<form method="GET">` filters (actor,
  action, branch [ADMIN + ALL scope only], from, to) + cursor "Next" / "Start over" `<Link>`s.
  Components `src/components/audit/{AuditFilters,AuditTable}.tsx` (shadcn `Table`).
- **`GET /api/audit/export?tab=job|portal|login`** (new) — `auth()` +
  `canAccessScreen(role, "audit")`; `portal` / `login` → **ADMIN only** (403 otherwise);
  `job` re-runs `getJobAuditPage` under `reportScope` (BM branch-forced). Loops cursors up
  to 25×200 = 5 000 rows, streams `text/csv`.

### `Session.ipAddress` / `Session.userAgent` — now populated
`src/lib/auth/auth.ts` `authorize(credentials, request)` (the 2nd arg was previously
ignored) reads `x-forwarded-for` (first hop) + `user-agent` from `request.headers` and
passes them into the existing `prisma.session.create`. Additive; the columns already
existed and were never written before.

### Security headers — `next.config.ts` `async headers()` on `/(.*)`
- **Enforced:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **Report-Only:** `Content-Security-Policy-Report-Only` — `default-src 'self'`;
  `img-src` adds `data: blob: https://images.unsplash.com`; `style-src 'self' 'unsafe-inline'`;
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (dev HMR + the shadcn `chart` inline
  `<style>`); `connect-src 'self' https://api.resend.com`; `frame-ancestors 'none'`;
  `object-src 'none'`; `base-uri`/`form-action 'self'`. **Report-Only on purpose** — it
  can't break `next dev` or the `@react-pdf` HTML-preview fallback while the policy is
  tuned. Tighten to enforcing + per-request nonces at deploy.

### OWASP spot-check
- **Route-auth sweep** — all 57 `src/app/api/**/route.ts` call `auth()` /
  `getPortalApiContext` / the `CRON_SECRET` check. The only "gap" is
  `api/auth/[...nextauth]/route.ts` (the NextAuth handler itself). Table below.
- **`src/app/api/test/job-fields/route.ts` deleted** — a Stage-0 fixture route that returned
  hard-coded data to prove the field-permission mechanism; obsolete since Stage 4. `GET`
  now → 404.
- **SQL** — the only raw SQL in `src/` is `dispatch.ts`'s
  `$queryRawUnsafe(... LIMIT $1 ..., limit)` (parameterized, `limit` is code-supplied) and
  the `FOR UPDATE SKIP LOCKED` claim (no interpolation). No string-built SQL anywhere; all
  other DB access is Prisma (parameterized). `seed-demo.ts`'s one raw `UPDATE` is also
  parameterized.
- **XSS** — `dangerouslySetInnerHTML` appears once: `src/components/shadcn/chart.tsx`
  (stock shadcn `ChartStyle`, injects `--color-*: <hex>` from a code-defined `ChartConfig`,
  never user input). The email templates (`mail/templates.ts`) HTML-escape every
  interpolated value. Prisma parameterizes all queries.
- Error responses across the API return `{ error }` JSON, never a stack trace.

### Performance pass (against `seed-demo` — ~665 jobs / 615 quotations / 705 enquiries)
2nd-request (compiled) timings, ADMIN, incl. Neon round-trips:

| Route | ms |
|---|---|
| `/api/dashboard/kpis` | ~200 |
| `/jobs?q=demo` | ~395 (target "1 000+ rows < ~1 s" — met) |
| `/audit?tab=portal` / `?tab=login` | ~315 / ~475 |
| `/reports/branch-performance` / `/reports/conversion` | ~450 |
| `/dashboard` | ~530 |
| `/audit?tab=job` | ~885 |
| `/reports/revenue` / `/reports/pending-ageing` | ~1 350 |

The two ~1.35 s reports are admin-only and infrequent; the cost is Neon latency +
in-JS aggregation over ~600 rows, not a missing index (Postgres seq-scans tables this
small regardless). Left as-is.

### Additive indexes (migration `20260903200000_stage_10d_audit_indexes`)
`Session @@index([userId])`, `Session @@index([createdAt])` (the login tab orders by it and
`sessions` had **no** index at all), `JobAuditLog @@index([actorId])` (the actor filter),
`Job @@index([organizationId, createdAt])` (the revenue report's per-customer filter).
Applied via the Neon serverless-adapter + throwaway-`tsx` workaround, then
`prisma generate` + dev restart. **No new models.** `IntegrationSyncLog` dropped (Stage 8
skipped). No job-field-diff logging.

## Route-auth sweep

| Result | Count |
|---|---|
| Calls `auth()` / portal guard / `CRON_SECRET` | 56 / 57 |
| NextAuth handler (`api/auth/[...nextauth]`) — N/A by design | 1 |
| Gaps | **0** |

## DB models added

None. Four additive `CREATE INDEX`. No column added (the two `Session` columns already
existed).

## Endpoints added

| Method | Path | Gate |
|---|---|---|
| GET | `/api/audit/export?tab=job\|portal\|login` | `auth()` + `canAccessScreen(role,"audit")`; `portal`/`login` → ADMIN only; `job` → BM branch-forced via `reportScope` |

## Endpoints removed

- `GET /api/test/job-fields` (Stage-0 fixture — obsolete).

## Endpoints changed

- The NextAuth credentials `authorize` now records `ipAddress` / `userAgent` on the
  `Session` login row (no external contract change).

## Permissions

- **`access-matrix.ts`** — new `"audit"` screen for ADMIN + BRANCH_MANAGER.
- **`capabilities.ts`** — no change (audit is read-only; gated by `canAccessScreen` +
  `reportScope` + per-tab ADMIN checks — the `accounts`/`reports` precedent).
- **`field-permissions.ts`** — no change.

## Key decisions

1. **One `[report]`-style page, three URL tabs** — server component, `<Link>` tabs,
   `<form GET>` filters, cursor pagination. No client tab state.
2. **`reportScope` reused for job-activity scoping** — BM sees only their branch, a
   crafted `?branchId=` fails closed (verified).
3. **CSP ships Report-Only** — enforcing it now would fight `next dev` HMR and the
   `@react-pdf` HTML fallback; the other five headers are enforced. Deploy step: enforcing
   CSP + nonces.
4. **Indexes added where the data grows unbounded** (`sessions`, `job_audit_logs`) or a
   real filter exists (`jobs.organizationId,createdAt`); the ~1.35 s reports were left
   un-indexed (small tables, latency-bound).
5. **`IntegrationSyncLog` dropped from the viewer** — Stage 8 was skipped, the model
   doesn't exist. Job-field-diff logging stays deferred (out of Stage 10 scope).

## Explicitly deferred

- **Enforcing CSP + per-request nonces** — deploy-time.
- **Job-form field-level change diffing into `JobAuditLog`** — still deferred (Stages 5–7).
- **A `/portal/audit` for customers** — customers have no audit surface by design.
- **Session pruning / retention job** — `sessions` grows on every login; a cron cleanup is
  a future add (the cron runner now exists from 10c).
- **Rate limiting / brute-force lockout on `/api/auth`** — not in scope.

## Verification

Throwaway `_tmp_verify_10d.mjs` (deleted, not committed) — per-role HTTP. **41 checks, all
passed:**
- **ADMIN**: `/audit` 200 with all three tabs; the "Logins" tab shows this run's
  `User agent` and the `x-forwarded-for` IP (**`Session` metadata now captured**); job CSV
  spans multiple branches; portal + login CSV 200; `/api/test/job-fields` → **404**; all
  six security headers present (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `HSTS`, `CSP-Report-Only`).
- **BRANCH_MANAGER**: `/audit` 200, **Job activity tab only** (Portal/Logins hidden); job
  CSV is **Mumbai-only**; `?tab=portal` / `?tab=login` export → **403**; a URL-forced
  `?tab=login` renders the job tab (no leak).
- **DOER / SALES / ACCOUNTS**: `/audit` → redirect; `/api/audit/export` → **403**. Anon →
  **401**.
- **Regression smoke** (ADMIN): `/dashboard`, `/jobs`, `/quotations`, `/enquiries`,
  `/customers`, `/documents`, `/reports`, `/settings`, `/audit`, `/notifications` — all 200.
- Separate check: a customer cross-org/not-found portal attempt writes a `PortalAccessLog`
  row that then appears in the ADMIN "Portal access" tab (Stage 9 logging → 10d viewer path
  confirmed; the test row was deleted afterward).

`tsc --noEmit`, `eslint src`, `npx next build` (all routes compile; `.next/types` stale
reference to the deleted route cleared with a dev restart) clean.

## Failover

PITR restore point recorded above. Security headers are config-only (revert
`next.config.ts`). The four indexes are additive (`DROP INDEX` on any regression; none
mutate data). `/audit` and its export are read-only. Revert = drop branch
`stage-10d-audit-hardening`.

---

## Stage 10 — done

All four sub-stages (10a shadcn foundation + dashboard · 10b reports + CXO KPIs ·
10c notifications · 10d audit viewer + hardening) are complete, each on its own branch
with its own checklist, none pushed. Stage 11 (Excel/Sheets cutover validation) is an
operational process, not a code build.
