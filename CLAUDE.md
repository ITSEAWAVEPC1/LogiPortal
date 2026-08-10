# Seawave Freight Forwarding Platform

Next.js 14 (App Router) + TypeScript + Prisma + Neon Postgres + NextAuth.js + Tailwind.
Deployed on Vercel. See docs/platform-development-plan.md for full spec, roles, and staged build plan.
See docs/original-process-reference.md for the source field list per workflow step.

## Conventions
- All schema changes are additive only — never drop/rename existing columns without an explicit migration discussion.
- Every API route must check role AND field-group permission via src/lib/permissions before returning or accepting data.
- Do not re-read the full codebase before starting a new stage. Trust docs/stage-checklists/*.md for what's already built.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
