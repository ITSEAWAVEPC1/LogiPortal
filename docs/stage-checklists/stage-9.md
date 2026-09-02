# Stage 9 — Customer Portal

Status: **Complete.** Acceptance criteria verified 2026-09-02 via a full direct-API run (50 checks, all passed) — per-role HTTP through the NextAuth credentials flow against the running dev server, plus a separate feature-flag-off restart check, plus `db:seed` idempotency. **Stage 8 (Real Integrations) was skipped** at the user's direction.

## What was built

- **`(portal)` route group** — a customer-only, strictly organization-scoped, **read-only** surface with its own slim shell (`src/app/(portal)/layout.tsx` → logo + `PortalNav` + sign-out; **not** the internal `Sidebar`/`Topbar`). Screens: `/portal` (simple landing — counts + recent shipments), `/portal/jobs` (+ `/[id]`), `/portal/quotations` (+ `/[id]`), `/portal/documents`, `/portal/profile`. **No** Enquiries (plan §4.2 = "No access"), no create/edit/approve anywhere, no internal notes / audit trail.
- **`organizationId` promoted into the session** — `authorize()` returns it, the `jwt`/`session` callbacks carry it, `src/types/next-auth.d.ts` augments all three shapes. `src/lib/documents/document-service.ts` `resolveViewerOrgId` is left as-is (still correct for the untouched Stage 7 document routes; works even on a pre-Stage-9 JWT). **Existing customer JWTs gain `organizationId` only on next login** (30-day expiry) — acceptable for a new feature.
- **Role routing** — `authorized()` in `auth.config.ts` bounces a logged-in CUSTOMER off every internal path to `/portal` and a logged-in non-CUSTOMER off `/portal` to `/dashboard` (best-effort, earliest bounce). `(dashboard)/layout.tsx` re-checks (`role === "CUSTOMER" → redirect("/portal")`) as the authoritative gate. `src/app/page.tsx` + `LoginForm` now route by role via `/`.
- **`src/lib/portal/`** (new, self-contained):
  - `guard.ts` — `getPortalContext()` (page/layout: redirect `/login` if anon, `notFound()` if flag off, redirect `/dashboard` if not CUSTOMER; returns `{ userId, userName, orgId }` straight from the session, `orgId` may be `null`). `getPortalApiContext()` (route handlers: JSON 401/404/403). `assertOwnOrg(resourceOrgId, ctx, meta)` — logs + `notFound()` on any mismatch. `logPortalAccess()` — one `PortalAccessLog` row, wrapped so a logging failure never turns a 404/403 into a 500. `NO_ORG = "__no_org__"` sentinel + `portalOrgWhere`.
  - `queries.ts` — every org-scoped fetch+shape helper the pages call (`getPortalDashboard`, `getPortalJobs`, `getPortalJob`, `getPortalQuotations`, `getPortalQuotation`, `getPortalDocuments(orgId, jobId?)`, `getPortalProfile`). `getPortalDocuments` is a thin wrapper over the **reused** `buildDocumentListWhere("CUSTOMER", orgId)` + `serializeDocument` (the one internal pure helper reused — it *is* the canonical CUSTOMER doc-scoping).
- **Isolated `/api/portal/*`** (user's confirmed choice — the portal never calls an internal API route):
  - `GET /api/portal/documents/[id]/file` — streams the **current** version only when `isActive && status APPROVED && sharedWithCustomer && job.organizationId === orgId`; else logs + 403. Byteless/FAILED → `{ fallback: true, data }` 200 (Stage 7 contract). Reuses the `readVersionFile` **lib**, not the internal route.
  - `GET /api/portal/quotations/[id]/pdf` — org-checks, then renders via the shared `renderQuotationPdf` **lib**; HTML-preview fallback on render failure.
  - Portal **pages** are server components doing direct org-scoped Prisma reads (standard App Router pattern, precedent in `documents/page.tsx`). The workflow step tracker is **fully server-rendered** from `JobWorkflowProgress` rows into a small vertical tracker in `PortalJobView` (teal/plum/gray dot rule) — no client fetch.
- **Duty-payment portal view** (§4.3 "View, if their liability" + §5.7) — `computeDutyView(incoterm, dutyPaymentLiability, dutyAmount)` in `queries.ts`. Always shows the invoice total; shows a **status label** from the Incoterm (`DDP → "Duty included in landed cost"`, `DDU → "Duty payable by consignee"`, else nothing); shows the **actual `dutyAmount`** only when `dutyPaymentLiability` reads like the customer's own side (`/(own|self|customer|shipper)/i` and not `/consignee/i`). `FieldPermission.CUSTOMER.dutyPayment` stays `NONE` — the portal never renders that field group.
- **Admin UI to link a customer login to an Organization** — `src/lib/users/user-write.ts` (`USER_SELECT`, `resolveUserOrganizationId(role, orgId)` — required + must be a real active org for CUSTOMER, forced `null` for every other role; lives outside the route files so Next doesn't treat it as an unknown route export). `POST /api/users` + `PATCH /api/users/[id]` persist `organizationId` (PATCH recomputes it only when `role`/`organizationId` is in the body, so a plain deactivate never re-validates a since-deactivated org). `UserManager` shows an Organization `Combobox` (wired to `GET /api/customers?q=`) when the role is CUSTOMER, and an Organization column in the table.
- **`DocumentsBrowser`** gained two optional props — `fileHrefFor?(d)` / `jobHrefFor?(d)` — defaulting to the internal links. The portal passes portal links via a thin `"use client"` wrapper `src/components/portal/PortalDocumentsBrowser.tsx` (function props **cannot** cross a Server→Client boundary — caught during verification as a hard 500; the wrapper creates them client-side).
- **Feature flag** — `src/lib/config/flags.ts` `customerPortalEnabled = process.env.CUSTOMER_PORTAL_ENABLED !== "false"` (default ON). When `false`: `/portal/*` → `notFound()` (404), `/api/portal/*` → 404, internal app entirely unaffected. Documented in `.env.example`.
- **`access-matrix.ts`** — `SCREEN_ACCESS.CUSTOMER = []` (the internal sidebar is dead for customers now; removes the long-standing nav-vs-capability mismatch).
- **`prisma/seed.ts`** — links `customer@test.seawave.com` to `Test Exports Pvt Ltd` (falls back to the oldest active org, then a created placeholder). Idempotent.

## DB models added

`PortalAccessLog` (append-only, **no** mutation/DELETE route — same convention as `JobAuditLog`): `{ id, userId → User (RESTRICT), viewerOrgId?, path, resourceType?, resourceId?, outcome, createdAt }`, indexes on `userId` + `createdAt`. Enum `PortalAccessOutcome` (`DENIED_CROSS_ORG | DENIED_UNLINKED | DENIED_NOT_FOUND`). Additive back-relation `User.portalAccessLogs`. **No new column** — `User.organizationId` already existed from Stage 7; the `Role` enum already had `CUSTOMER` (the plan's "extend User role enum" was already done).

Migration `prisma/migrations/20260902220000_stage_9_customer_portal/` — **4 statements, all `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT`** (no DROP/RENAME/ALTER COLUMN). Applied via the serverless-adapter + tsx workaround ([[prisma-migrate-neon-workaround]]) — the migrate CLI still can't reach Neon on this machine — then `prisma generate` + dev-server restart.

## Endpoints added

- `GET /api/portal/documents/[id]/file`, `GET /api/portal/quotations/[id]/pdf` (both new, read-only, org-scoped, isolated).

## Endpoints changed (additive, not breaking)

- `POST /api/users` — accepts optional `organizationId`; 400 if a CUSTOMER is created without one, 404 if it doesn't resolve to an active org. Response `user` now includes `organization`.
- `PATCH /api/users/[id]` — accepts optional `organizationId`; recomputed against the effective role only when `role` or `organizationId` is present in the body; cleared when the role is/becomes non-CUSTOMER.
- The internal `GET /api/documents/*` and `GET /api/quotations/[id]/pdf` routes were **not** touched (isolation choice).

## Permissions

- **`capabilities.ts`** — **no change.** The portal does not use `can()` for its own screens; it uses `getPortalContext()`/`getPortalApiContext()`. CUSTOMER still has only `documents: ["view"]` (unused by the portal path, which is server-rendered).
- **`field-permissions.ts` / `prisma/seed.ts` FieldPermission rows** — **no change.** `CUSTOMER` job/organization rows stay as Stage 6/7 left them (`dutyPayment: NONE`, etc.). The portal renders its own curated read-only views and never calls `redactJobForRole`.
- **`access-matrix.ts`** — `SCREEN_ACCESS.CUSTOMER = []` (see above).

## Key decisions (confirmed with the user)

1. **Fully isolated `/api/portal/*`** — the portal never calls an internal API route (only two new file/PDF stream routes; pages read Prisma directly; the tracker is server-rendered). Shared **libs** (`readVersionFile`, `renderQuotationPdf`, `buildDocumentListWhere`, `serializeDocument`) are reused — they are libraries, not routes.
2. **New append-only `PortalAccessLog` table** for the §8 "log any attempted violation" criterion — verifiable, and feeds Stage 10's audit viewer.
3. **Duty view = status label + conditional amount** (see above). **Assumption flagged:** the free-text `dutyPaymentLiability` naming convention (`own`/`self`/`shipper`/`customer` vs `consignee`) is a guess — the source docs never enumerate its values. Revisit if a real value set appears.
4. **Portal home = simple landing + a read-only profile page.** The rich CXO dashboard (YTD/MTD/WTD, charts) stays Stage 10, like the internal `/dashboard` stub.

## Implementation decisions (made during the build)

- **Server→Client function props are illegal in RSC** — `DocumentsBrowser`'s new `fileHrefFor`/`jobHrefFor` are passed from the client-side `PortalDocumentsBrowser` wrapper, not the server page. (Caught as a reproducible 500 during verification, not shipped.)
- **Portal lists are server-rendered with URL-driven filters** (`<form method=GET>` + `<Link>` pagination, `PortalPagination.tsx`) — zero client JS, fully within "server components query directly".
- **`resolveUserOrganizationId` + `USER_SELECT` live in `src/lib/users/user-write.ts`**, not exported from a `route.ts` (Next flags non-HTTP exports from route files).
- **PATCH `/api/users/[id]` only recomputes the org link when role/organizationId is in the body** — otherwise a plain `{ isActive: false }` deactivate on a customer whose org was since deactivated would 404.
- **`getPortalContext` reads `session.user.organizationId` directly** — no per-request `resolveViewerOrgId` DB lookup for portal pages.
- Money formatted with `Intl.NumberFormat("en-IN")` in `portal-format.ts` (currency style when a code is present, decimal otherwise) — first place in the app that formats money for display; not a schema/precision change (`Float` convention unchanged).

## Explicitly deferred (per plan scope)

- **Rich CXO dashboard** (YTD/MTD/WTD, revenue/on-time charts, PDF export) — Stage 10, alongside the internal `/dashboard`.
- **Email notifications to the customer** (quotation sent, document shared, job delivered) — Stage 10.
- **Customer self-service actions** (accept a quotation in-portal) — not planned; §5.3 records customer approval manually via Sales.
- **Admin "view portal as customer" / impersonation.**
- **`PortalAccessLog` surfaced in a UI** — Stage 10's audit-trail viewer.

## Verification

Throwaway `tsx` script (`_tmp_verify_stage9.mts`, deleted after) — per-role HTTP through the NextAuth credentials flow against the running dev server, direct Prisma for setup/assert/teardown. **50 checks, all passed:**

1. **Portal renders** for a linked customer (Org A): `/portal`, `/portal/jobs`, `/portal/jobs/[id]`, `/portal/quotations`, `/portal/quotations/[id]`, `/portal/documents`, `/portal/profile` → all 200; the jobs list shows Org A's job and not Org B's; the job detail shows routing + a workflow step label + the invoice total; the profile shows the org name.
2. **Cross-org block** (the §8 acceptance criterion) — Org-A customer GET `/portal/jobs/[B-job]` and `/portal/quotations/[B-quote]` → **404**, each writing a `PortalAccessLog` `DENIED_CROSS_ORG` row; `GET /api/portal/documents/[B-doc]/file` and `/api/portal/quotations/[B-quote]/pdf` → **403** + log rows (≥4 total); the untouched internal `/api/documents/[B-doc]/versions/[v]/file` still → 403.
3. **Internal routes blocked** — Org-A customer: `/dashboard`, `/jobs`, `/jobs/[id]` → 3xx redirect to `/portal`; `/api/jobs`, `/api/jobs/[id]`, `/api/quotations`, `/api/enquiries` → 403.
4. **Document scoping** — `/portal/documents` shows exactly the one APPROVED+`sharedWithCustomer` Org-A doc (not the draft, not the un-shared, not Org B's); the shared doc downloads 200 via `/api/portal`.
5. **Duty view** — a DDP job shows "Duty included in landed cost" and (consignee liable) hides the amount row; a DDU job shows "Duty payable by consignee" and (own liability) shows the amount row.
6. **Non-customer isolation + regression** — admin GET `/portal`, `/portal/jobs` → 3xx to `/dashboard`; admin `GET /api/portal/documents/[A]/file` → 403; admin `/jobs`, `/quotations`, `/documents`, `/enquiries`, `/settings/users` all still 200.
7. **Unlinked customer** — a CUSTOMER with `organizationId = null`: `/portal` → 200 rendering the "not linked" card, `/portal/jobs` → 200 with no data, no crash.
8. **Admin link UI** — `POST /api/users` CUSTOMER with no `organizationId` → 400; with a valid one → 201 + linked; `PATCH { organizationId }` → 200 + re-linked; `PATCH { role: "DOER" }` → 200 + org cleared; non-admin `POST /api/users` → 403.
9. **Feature flag** (separate dev restart with `CUSTOMER_PORTAL_ENABLED=false`) — a logged-in customer's `/portal`, `/portal/jobs`, `/portal/documents` → **404**; `/api/portal/*` → 404; admin `/jobs`, `/quotations`, `/documents`, `/settings/users`, `/dashboard` → all still 200. Restored to enabled afterward.

`npx prisma generate` clean. `tsc --noEmit` and `eslint src prisma` both zero errors. `npm run db:seed` run twice — stable; the test customer link is idempotent (points at `Test Exports Pvt Ltd`, no placeholder org created). All ZZZ test data (orgs / jobs / quotations / documents / versions / workflow progress / `zz-` users / their sessions / their `PortalAccessLog` rows) deleted afterward (teardown runs even on assertion failure; a first run tripped the `Session` RESTRICT FK and was fixed to delete sessions before users). Throwaway scripts removed, not committed.

## Failover

The `(portal)` route group and `/api/portal/*` are gated by one env var and share no state or API logic with the internal dashboard beyond read-only, organization-scoped queries. `PortalAccessLog` is append-only. No tag/push for this stage's completion — pushing to `origin/main` is a separate explicit user request.
