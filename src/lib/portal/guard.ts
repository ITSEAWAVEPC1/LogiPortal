import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { customerPortalEnabled } from "@/lib/config/flags";
import type { PortalAccessOutcome } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Stage 9 — customer portal access control.
//
// The portal is CUSTOMER-only, strictly organization-scoped, read-only, and
// lives entirely under /app/(portal). Everything a portal page or /api/portal
// route needs to gate a request flows through here. Every denied
// cross-organization attempt is written to PortalAccessLog (plan §8).
// ---------------------------------------------------------------------------

/** Sentinel org id — an unlinked customer's WHERE clause matches nothing. */
export const NO_ORG = "__no_org__";

export interface PortalContext {
  userId: string;
  userName: string;
  /** null when the customer login is not yet linked to an organization. */
  orgId: string | null;
}

/**
 * Guard for a portal page or layout (server component). Redirects an
 * unauthenticated visitor to /login, a non-CUSTOMER to /dashboard, and 404s
 * the whole route group when the feature flag is off.
 */
export async function getPortalContext(): Promise<PortalContext> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!customerPortalEnabled) notFound();
  if (session.user.role !== "CUSTOMER") redirect("/dashboard");

  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Customer",
    orgId: session.user.organizationId,
  };
}

interface LogPortalAccessArgs {
  userId: string;
  viewerOrgId: string | null;
  path: string;
  resourceType?: "job" | "quotation" | "document";
  resourceId?: string;
  outcome: PortalAccessOutcome;
}

/** Append one PortalAccessLog row. Never throws — a logging failure must not
 *  turn a correct 404/403 into a 500. */
export async function logPortalAccess(args: LogPortalAccessArgs): Promise<void> {
  try {
    await prisma.portalAccessLog.create({
      data: {
        userId: args.userId,
        viewerOrgId: args.viewerOrgId,
        path: args.path,
        resourceType: args.resourceType ?? null,
        resourceId: args.resourceId ?? null,
        outcome: args.outcome,
      },
    });
  } catch (err) {
    console.error("[portal] failed to write PortalAccessLog", err);
  }
}

function outcomeFor(resourceOrgId: string | null, viewerOrgId: string | null): PortalAccessOutcome {
  if (resourceOrgId === null) return "DENIED_NOT_FOUND";
  if (viewerOrgId === null) return "DENIED_UNLINKED";
  return "DENIED_CROSS_ORG";
}

/**
 * Cross-organization guard for a portal `[id]` page. `resourceOrgId` is the
 * organization the resource actually belongs to (pass `null` when the row did
 * not resolve at all). Any mismatch is logged and then `notFound()` — the
 * customer never learns whether the id exists.
 */
export async function assertOwnOrg(
  resourceOrgId: string | null,
  ctx: PortalContext,
  meta: { path: string; resourceType: "job" | "quotation" | "document"; resourceId: string },
): Promise<void> {
  if (resourceOrgId !== null && ctx.orgId !== null && resourceOrgId === ctx.orgId) return;

  await logPortalAccess({
    userId: ctx.userId,
    viewerOrgId: ctx.orgId,
    path: meta.path,
    resourceType: meta.resourceType,
    resourceId: meta.resourceId,
    outcome: outcomeFor(resourceOrgId, ctx.orgId),
  });
  notFound();
}

/** `{ organizationId }` WHERE fragment, sentinel-guarded for an unlinked user. */
export function portalOrgWhere(orgId: string | null): { organizationId: string } {
  return { organizationId: orgId ?? NO_ORG };
}

// --- /api/portal route guard ------------------------------------------

export type PortalApiGuard =
  | { ok: true; userId: string; orgId: string | null }
  | { ok: false; response: NextResponse };

/**
 * Guard for an /api/portal/* route handler (returns a JSON NextResponse rather
 * than redirecting). 401 when signed out, 404 when the portal is disabled, 403
 * for any non-CUSTOMER caller.
 */
export async function getPortalApiContext(): Promise<PortalApiGuard> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!customerPortalEnabled) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (session.user.role !== "CUSTOMER") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id, orgId: session.user.organizationId };
}
