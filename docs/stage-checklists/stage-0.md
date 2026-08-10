# Stage 0 — Foundation & Design System

Status: **Complete.** Acceptance criteria verified 2026-08-10 (see below).

## What was built

- Next.js 16 (App Router) + TypeScript + Tailwind v4, scaffolded via `create-next-app`.
- Prisma 7 wired to Neon Postgres via `@prisma/adapter-neon` (see "Key decisions" — Prisma 7 requires an explicit driver adapter, `datasource.url` in `schema.prisma` no longer works).
- NextAuth v5 (Auth.js) with a Credentials provider (email + password), JWT session strategy, edge-safe `middleware.ts` guarding all routes except `/login`, `/api/auth/*`, `/design-system`.
- Shared component library in `src/components/ui`: `Button`, `Card`, `Badge`, `Modal`, `Input`, `Select`, `Textarea`, `Checkbox`, `DataTable`, `StepTracker` (vertical + horizontal), all styled from `src/styles/tokens.css` (Section 2.1 brand tokens as CSS variables, mapped into Tailwind's `@theme`). Visual QA page at `/design-system` (public, not in sidebar).
- Layout shell: `src/components/layout/Sidebar.tsx` + `Topbar.tsx`, wired to `src/lib/permissions/access-matrix.ts` (Section 4.2 screen-level access). Each nav destination has a placeholder page noting which future stage builds it for real.
- Permissions engine: `src/lib/permissions/field-permissions.ts` reads the `FieldPermission` table at request time — `getFieldAccess(role, resource, fieldGroup)` / `getFieldAccessMap(role, resource)`.
- Seed script (`prisma/seed.ts`): 7 branches, 6 test users (one per role, password `password123`), `FieldPermission` rows for all 6 roles × 7 job field groups.
- Demo API: `GET /api/test/job-fields` — proves server-side field-group enforcement against a fixture Job object (real `Job` entity ships in Stage 4).

## DB models added

`Branch`, `User`, `Session` (see decision below — not NextAuth's session store), `FieldPermission`. Enums: `Role`, `FieldAccessLevel`.

## Key decisions / deviations from the plan doc

1. **Prisma 7 driver adapters.** Prisma 7 removed `datasource.url` from `schema.prisma` entirely — the CLI reads the connection string from `prisma.config.ts`, and `PrismaClient` at runtime requires an explicit `adapter`. Used `@prisma/adapter-neon` + `@neondatabase/serverless` (the Neon-recommended pairing for serverless/edge deployment on Vercel). See `src/lib/db/prisma.ts`.
2. **`Session` model is a login-audit log, not NextAuth's session store.** NextAuth's Credentials provider only supports the `jwt` session strategy — database sessions aren't supported for credentials logins. So `Session` is written by our own `authorize()` callback (user, timestamp, expiry) rather than by NextAuth itself. Doubles as a head start on Stage 10's audit trail.
3. **No `@auth/prisma-adapter`.** Since sessions are JWT-only and there's no OAuth provider yet, the Credentials `authorize()` callback queries `User` directly via Prisma instead of going through the adapter — avoids pulling in `Account`/`VerificationToken` tables not listed in Stage 0's DB scope.
4. **"Accounts" sidebar item assumption.** Section 2.2 lists "Accounts" as a nav item; Section 4.2's access matrix has no row for it. Defaulted visibility to Admin, Branch Manager, and Accounts/Finance roles. **Needs confirmation** — easy one-line change in `src/lib/permissions/access-matrix.ts` if wrong.
5. **Field permissions simplified to NONE/VIEW/EDIT.** Section 4.3's finer nuances ("own entries only", "if their liability") aren't encoded yet — they need row-level checks against a real `Job` record, which doesn't exist until Stage 4/6. Stage 0 proves the (role, resource, fieldGroup) → access mechanism works end-to-end; nuance is a later-stage addition, not a rebuild.
6. **Real secrets live in `.env`** (not `.env.local` as originally sketched) — matches what `prisma init` already wired into `prisma.config.ts` via `dotenv/config`. `.env*` is gitignored; `.env.example` has the placeholder template.

## Test users (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@test.seawave.com | password123 |
| Branch Manager | branchmgr@test.seawave.com | password123 |
| Doer | doer@test.seawave.com | password123 |
| Sales | sales@test.seawave.com | password123 |
| Accounts | accounts@test.seawave.com | password123 |
| Customer | customer@test.seawave.com | password123 |

## Acceptance criteria — verified

1. **Dev server runs clean.** `npm run dev` — Ready in 5.5s. `tsc --noEmit` and `npm run lint` both pass with zero errors.
2. **Sidebar differs per role.** Confirmed via authenticated requests: Sales sees `dashboard, customers, enquiries, quotations, jobs, documents, reports` (no `/accounts`); Accounts additionally sees `/accounts`. Full per-role mapping in `access-matrix.ts`.
3. **Field-permission API enforces server-side restriction.** `GET /api/test/job-fields`: Sales gets `dutyPayment: {access: "NONE"}` (no data returned) and `charges: {access: "VIEW", data: {...}}`; Accounts gets `dutyPayment: {access: "EDIT", data: {...}}` and `charges: {access: "EDIT", data: {...}}` — same fixture Job, different access per role, enforced in the route handler via the DB-backed `FieldPermission` table (not just hidden in the UI).
4. **Unauthenticated access blocked.** `GET /api/test/job-fields` → 401 without a session. `GET /dashboard` → 307 redirect to `/login` without a session (via `middleware.ts`).

## Failover

Tagged `stage-0-foundation` on this commit per the plan doc's Stage 0 failover requirement.

Local Docker Postgres fallback (mentioned in the master plan) was **not** set up — Docker isn't installed on the dev machine and Neon wasn't flagged as unreliable. Known gap; revisit if Neon reliability becomes a concern.
