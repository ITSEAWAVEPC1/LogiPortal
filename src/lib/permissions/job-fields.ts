import { getFieldAccessMap, JOB_FIELD_GROUPS, type FieldAccessLevel, type JobFieldGroup } from "./field-permissions";
import type { Role } from "./roles";
import { JOB_FIELD_GROUP_KEYS } from "@/lib/validation/job";

// Section 4.3 field-group access for the Job entity, one level per group
// (missing rows default to NONE). Analogous to organization-sections.ts.
export type JobFieldAccessMap = Record<JobFieldGroup, FieldAccessLevel>;

export async function getJobFieldAccess(role: Role): Promise<JobFieldAccessMap> {
  const map = await getFieldAccessMap(role, "job");
  const result = {} as JobFieldAccessMap;
  for (const group of JOB_FIELD_GROUPS) {
    result[group] = map[group] ?? "NONE";
  }
  return result;
}

// Removes the columns/relations a role has NONE access to, so a restricted
// role cannot retrieve them even via a direct API call (plan line 120). Used
// by both the API GET route and the server-rendered detail page.
export function redactJobForRole<T extends Record<string, unknown>>(job: T, access: JobFieldAccessMap): Partial<T> {
  const out: Record<string, unknown> = { ...job };
  for (const group of JOB_FIELD_GROUPS) {
    if (access[group] === "NONE") {
      for (const key of JOB_FIELD_GROUP_KEYS[group]) delete out[key];
    }
  }
  return out as Partial<T>;
}
