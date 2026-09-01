import { prisma } from "@/lib/db/prisma";
import { organizationInputSchema } from "@/lib/validation/organization";
import { normalizeGst } from "@/lib/validation/kyc";
import { CUSTOMER_TARGET_FIELDS } from "./column-matcher";
import type { RowError, ValidatedRow, ValidationResult } from "./types";

// Re-exported so existing importers (ImportWizard, commit route) keep working
// after the shapes moved to ./types for the Job validator to share.
export type { RowError, ValidatedRow, ValidationResult } from "./types";

/**
 * The one shared validator for Customer rows — used identically by the
 * interactive validate step (src/app/api/data-import/validate/route.ts) and
 * the commit step (src/app/api/data-import/commit/route.ts), which always
 * re-validates rather than trusting client-computed validity.
 */
export async function validateCustomerRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>,
): Promise<ValidationResult> {
  const mappedRows = rawRows.map((raw) => {
    const mapped: Record<string, string> = {};
    for (const field of CUSTOMER_TARGET_FIELDS) {
      const sourceHeader = mapping[field.key];
      mapped[field.key] = sourceHeader ? (raw[sourceHeader] ?? "").trim() : "";
    }
    return { raw, mapped };
  });

  // Batched duplicate-GST lookup against existing DB rows (one query, not N).
  const gstValues = [...new Set(mappedRows.map((r) => r.mapped.gstNumber).filter(Boolean).map(normalizeGst))];
  const existingGsts = gstValues.length
    ? await prisma.kycDetail.findMany({ where: { gstNumber: { in: gstValues } }, select: { gstNumber: true } })
    : [];
  const existingGstSet = new Set(existingGsts.map((k) => k.gstNumber));

  const seenInFile = new Set<string>();
  const rows: ValidatedRow[] = mappedRows.map(({ raw, mapped }, index) => {
    const errors: RowError[] = [];

    const parsed = organizationInputSchema.safeParse({
      name: mapped.name,
      contactPersonName: mapped.contactPersonName,
      contactPersonPhone: mapped.contactPersonPhone,
      contactPersonEmail: mapped.contactPersonEmail,
      city: mapped.city,
      state: mapped.state,
      gstNumber: mapped.gstNumber,
      panNumber: mapped.panNumber,
      tanNumber: mapped.tanNumber,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ field: String(issue.path[0] ?? "form"), message: issue.message });
      }
    }

    if (mapped.gstNumber) {
      const normalized = normalizeGst(mapped.gstNumber);
      if (existingGstSet.has(normalized)) {
        errors.push({ field: "gstNumber", message: "GST number already exists in the system" });
      } else if (seenInFile.has(normalized)) {
        errors.push({ field: "gstNumber", message: "Duplicate GST number within this file" });
      } else {
        seenInFile.add(normalized);
      }
    }

    return { rowNumber: index + 1, raw, mapped, valid: errors.length === 0, errors };
  });

  return {
    rows,
    validCount: rows.filter((r) => r.valid).length,
    invalidCount: rows.filter((r) => !r.valid).length,
  };
}
