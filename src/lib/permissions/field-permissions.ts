import { prisma } from "@/lib/db/prisma";
import type { Role } from "./roles";

// The 7 field groups from docs/platform-development-plan.md Section 4.3
// (Job detail screen). "job" is the only resource seeded in Stage 0 — the
// real Job entity doesn't exist until Stage 4, so this proves the mechanism
// against a fixture shape (see src/app/api/test/job-fields/route.ts).
export const JOB_FIELD_GROUPS = [
  "shipperConsigneeNotify",
  "portVesselContainer",
  "workflowStatus",
  "charges",
  "dutyPayment",
  "internalNotes",
  "documents",
] as const;

export type JobFieldGroup = (typeof JOB_FIELD_GROUPS)[number];

export type FieldAccessLevel = "NONE" | "VIEW" | "EDIT";

/**
 * Reads the (role, resource, fieldGroup) -> access mapping from the
 * FieldPermission table. Row-level nuance ("own entries only", "if their
 * liability") is out of scope until the real Job entity exists (Stage 4/6) —
 * this only proves role-based field-group enforcement works end-to-end.
 */
export async function getFieldAccess(
  role: Role,
  resource: string,
  fieldGroup: string,
): Promise<FieldAccessLevel> {
  const permission = await prisma.fieldPermission.findUnique({
    where: { role_resource_fieldGroup: { role, resource, fieldGroup } },
  });
  return permission?.access ?? "NONE";
}

export async function getFieldAccessMap(
  role: Role,
  resource: string,
): Promise<Record<string, FieldAccessLevel>> {
  const permissions = await prisma.fieldPermission.findMany({
    where: { role, resource },
  });
  const map: Record<string, FieldAccessLevel> = {};
  for (const p of permissions) {
    map[p.fieldGroup] = p.access;
  }
  return map;
}
