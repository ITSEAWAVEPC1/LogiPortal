import { prisma } from "@/lib/db/prisma";

// Shared shape + validation for the two user-write routes (POST /api/users,
// PATCH /api/users/[id]). Lives outside the route files so Next doesn't treat
// the helper as an unknown route export.

export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  branch: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
} as const;

/**
 * Resolve the `organizationId` to persist for a user write, enforcing the
 * Stage 9 rule: a CUSTOMER user must be linked to a real, active organization;
 * every other role is force-unlinked.
 */
export async function resolveUserOrganizationId(
  role: string,
  organizationId: string | undefined,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string; status: number }> {
  if (role !== "CUSTOMER") return { ok: true, value: null };
  const id = organizationId?.trim();
  if (!id) return { ok: false, error: "A customer user must be linked to an organization", status: 400 };
  const org = await prisma.organization.findFirst({ where: { id, isActive: true }, select: { id: true } });
  if (!org) return { ok: false, error: "Organization not found", status: 404 };
  return { ok: true, value: org.id };
}
