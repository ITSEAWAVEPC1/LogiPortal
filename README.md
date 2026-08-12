# LogiPortal (Seawave Freight Forwarding Platform)

Internal operations platform for a freight forwarding company — customer/org master data, enquiries, job workflow, and role-based access control.

Next.js 14 (App Router) + TypeScript + Prisma + Neon Postgres + NextAuth.js + Tailwind. Deployed on Vercel.

For the full spec, roles, and staged build plan, see [docs/platform-development-plan.md](docs/platform-development-plan.md). For what's already built stage-by-stage, see [docs/stage-checklists/](docs/stage-checklists/).

## Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database (free tier is fine) — grab the **pooled connection string** from the Neon dashboard
- npm (comes with Node)

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

   This also runs `prisma generate` automatically (via `postinstall`).

2. **Configure environment variables**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string, e.g. `postgresql://user:password@host/dbname?sslmode=require` |
   | `NEXTAUTH_SECRET` | Random secret for session encryption — generate with `npx auth secret` or `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `http://localhost:3000` for local dev |

3. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

   This applies all migrations in `prisma/migrations` to your Neon database.

4. **Seed test data**

   ```bash
   npm run db:seed
   ```

   Seeds branches, role-based field permissions, and one test user per role (password for all: `password123`):

   | Role | Email |
   | --- | --- |
   | Admin | `admin@test.seawave.com` |
   | Branch Manager | `branchmgr@test.seawave.com` |
   | Doer | `doer@test.seawave.com` |
   | Sales | `sales@test.seawave.com` |
   | Accounts | `accounts@test.seawave.com` |
   | Customer | `customer@test.seawave.com` |

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with any of the seeded accounts above.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate the Prisma client (`src/generated/prisma`) |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seed branches, users, and field permissions |

## Project structure

- `src/` — application code (App Router pages, API routes, `src/lib/permissions` for role/field access control)
- `prisma/schema.prisma` — database schema; `prisma/migrations/` — migration history; `prisma/seed.ts` — seed script
- `docs/platform-development-plan.md` — full product spec, roles, and staged build plan
- `docs/original-process-reference.pdf` — source field list per workflow step
- `docs/stage-checklists/` — what's been built per stage, with verification notes
- `tests/` — test fixtures and fixture generators

## Notes for contributors

- Schema changes are **additive only** — never drop or rename existing columns without an explicit migration discussion.
- Every API route must check role **and** field-group permission via `src/lib/permissions` before returning or accepting data.
- Don't re-read the whole codebase before starting a new stage — `docs/stage-checklists/*.md` tracks what's already built.

See [CLAUDE.md](CLAUDE.md) for the full set of conventions used when developing this project with Claude Code.
