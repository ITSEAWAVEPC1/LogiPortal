# Seawave Freight Forwarding Platform

Next.js 16 (App Router) + TypeScript + Prisma 7 + Neon Postgres + NextAuth v5 + Tailwind v4.
Targets Vercel for hosting (not deployed yet — local dev only so far). See docs/platform-development-plan.md for full spec, roles, and staged build plan.
See docs/original-process-reference.pdf for the source field list per workflow step (page 1 = Organization Creation, page 2 = Enquiry Capturing, pages 3-6 = Import/Export Freight Forwarding process detail).

## Status

Stages 0, 1, 2 complete, committed, and pushed to `origin/main`. Customer Master v2 (Organization enhancement — Branches/Account Info/Billing/Bank Details/Customize Columns, built on Stage 1's Organization model) also complete, not yet committed — see `docs/stage-checklists/customer-master-v2.md`. **Next up: Stage 3 (Quotation Module).**

Before starting a new stage, read `docs/stage-checklists/stage-{N}.md` for each completed stage — what was built, DB models added, decisions/assumptions made and why. Don't re-read the full codebase or re-derive decisions already written down there; open a specific file only to confirm an exact shape (a Prisma field name, a component prop) when it matters.

Models so far: `User`, `Role`, `Branch`, `Session` (login-audit log only, not the real auth session), `FieldPermission` (Stage 0) · `Organization`, `KycDetail`, `ImportBatch`, `ImportRowError` (Stage 1) · `Enquiry`, `EnquiryFreightDetail`, `EnquiryCustomsDetail`, `EnquiryTransportDetail` (Stage 2) · `OrganizationBranch`, `BranchAddress`, `BranchContact`, `BranchAccountManager`, `OrganizationBankAccount`, `CustomerAccountInfo`, `VendorAccountInfo`, `BillType`, `OrganizationBillType`, `UserColumnPreference` (Customer Master v2).

## Environment gotchas (this dev machine)

- Node/npm are installed but not always on PATH in a fresh shell. PowerShell: prefix commands with `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`. Bash: call `/c/Program Files/nodejs/node.exe` by full path.
- **Restart the dev server after any Prisma schema change.** `npx prisma generate` rewrites the client on disk, but an already-running `next dev` process keeps the stale one in memory — "Unknown argument" or "Cannot read properties of undefined" on a field/model that clearly exists in schema.prisma is the tell. Kill and restart, don't debug the schema.
- Neon connection string lives in `.env` (gitignored) as `DATABASE_URL`. Never guess or fabricate one — ask the user if it's needed and not already available.
- Test users (all seeded, password `password123`): admin@test.seawave.com, branchmgr@test.seawave.com, doer@test.seawave.com, sales@test.seawave.com, accounts@test.seawave.com, customer@test.seawave.com.

## Conventions
- All schema changes are additive only — never drop/rename existing columns without an explicit migration discussion.
- Prisma 7 has no `datasource.url` in schema.prisma — connections go through a driver adapter. See `src/lib/db/prisma.ts` (the `@prisma/adapter-neon` singleton pattern) before writing any new Prisma-touching script.
- `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` — see its file comment if this trips up a future edit) is the request gate, and its matcher excludes `/api/*` entirely — there is **no edge/proxy-level auth on API routes**. Every route handler must call `auth()` and check permissions itself (see any existing route under `src/app/api/` for the pattern).
- Three separate, deliberately-not-unified permission mechanisms — don't conflate them: `src/lib/permissions/access-matrix.ts` (sidebar nav visibility, boolean), `capabilities.ts` (per-action view/create/edit/delete/approve per role per screen), `field-permissions.ts` (DB-backed per-field-group access, for the Job entity's Section 4.3 matrix specifically).
- Soft delete only, structurally — no DELETE verb exists on any API route anywhere in the app. Deactivation is always PATCH `{isActive: false}`.
- Reuse before rebuilding: generic UI primitives live in `src/components/ui/` (Button, Card, Badge, Modal, Input, Select, Textarea, Checkbox, DataTable, StepTracker, FileDropzone, Combobox, ColumnPicker), shared cross-feature components in `src/components/shared/` (CustomerFormModal). Check there before writing something that might already exist.
- Verify with direct API calls per role (a small Node fetch script, not just UI clicking) before calling a stage done — this has caught a real bug in every stage so far (a stale Prisma client, a transaction-timeout from per-row inserts vs. Neon's real network latency, a type-design flaw in a generic component, a React 19 lint rule catching a genuinely fragile pattern). Clean up test/verification data from the DB afterward — check `docs/stage-checklists/stage-2.md`'s cleanup section for the pattern (a small throwaway `tsx` script run and deleted, not committed).
- Do not re-read the full codebase before starting a new stage.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
