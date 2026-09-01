import { CUSTOMER_TARGET_FIELDS, type TargetField } from "./column-matcher";
import { JOB_TARGET_FIELDS } from "@/lib/validation/job";

// The two entity types the bulk-import wizard supports. Mirrors the Prisma
// `ImportEntityType` enum (CUSTOMER shipped in Stage 1, JOB added in Stage 4).
export type ImportEntity = "CUSTOMER" | "JOB";

export function isImportEntity(value: unknown): value is ImportEntity {
  return value === "CUSTOMER" || value === "JOB";
}

export function targetFieldsFor(entity: ImportEntity): TargetField[] {
  return entity === "JOB" ? JOB_TARGET_FIELDS : CUSTOMER_TARGET_FIELDS;
}
