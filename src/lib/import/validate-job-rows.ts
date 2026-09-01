import { prisma } from "@/lib/db/prisma";
import { normalizeGst } from "@/lib/validation/kyc";
import {
  JOB_TARGET_FIELDS,
  parseImportNumber,
  parseImportServiceTypes,
  resolveImportJobStatus,
  resolveImportShipmentType,
  type JobStatusValue,
} from "@/lib/validation/job";
import type { RowError, ValidatedRow, ValidationResult } from "./types";

export interface JobRowResolution {
  branchId: string;
  organizationId: string;
  shipmentType: "IMPORT" | "EXPORT";
  status: JobStatusValue;
  serviceTypes: string[];
}

export interface JobValidationResult extends ValidationResult {
  // Keyed by rowNumber; only populated for rows that passed validation, so the
  // commit route can build the Job rows without re-resolving customers/branches.
  resolved: Record<number, JobRowResolution>;
}

const NUMERIC_KEYS = [
  "freeDaysAtPod",
  "containerCount",
  "totalGrossWeight",
  "totalNetWeight",
  "totalPackages",
  "volumeCbm",
] as const;

/**
 * The one shared validator for Job import rows — used by the validate step and
 * re-run by the commit step (never trusts client-computed validity). Mirrors
 * validateCustomerRows: map columns, batch-resolve foreign keys, flag rows.
 */
export async function validateJobRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string | null>,
): Promise<JobValidationResult> {
  const mappedRows = rawRows.map((raw) => {
    const mapped: Record<string, string> = {};
    for (const field of JOB_TARGET_FIELDS) {
      const sourceHeader = mapping[field.key];
      mapped[field.key] = sourceHeader ? (raw[sourceHeader] ?? "").trim() : "";
    }
    return { raw, mapped };
  });

  // Batched foreign-key resolution — customers by GST or name, branches by
  // code or name (one query each, not N).
  const gstValues = [...new Set(mappedRows.map((r) => r.mapped.gstNumber).filter(Boolean).map(normalizeGst))];
  const nameValues = [...new Set(mappedRows.map((r) => r.mapped.customerName).filter(Boolean))];
  const branchValues = [...new Set(mappedRows.map((r) => r.mapped.branch).filter(Boolean))];

  const [gstRows, nameRows, branchRows] = await Promise.all([
    gstValues.length
      ? prisma.kycDetail.findMany({ where: { gstNumber: { in: gstValues } }, select: { gstNumber: true, organizationId: true } })
      : Promise.resolve([]),
    nameValues.length
      ? prisma.organization.findMany({ where: { name: { in: nameValues, mode: "insensitive" } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    branchValues.length
      ? prisma.branch.findMany({
          where: { OR: [{ name: { in: branchValues, mode: "insensitive" } }, { code: { in: branchValues, mode: "insensitive" } }] },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const gstToOrg = new Map(gstRows.filter((k) => k.gstNumber).map((k) => [k.gstNumber as string, k.organizationId]));
  const nameToOrg = new Map<string, string>();
  for (const o of nameRows) {
    const key = o.name.toLowerCase();
    if (!nameToOrg.has(key)) nameToOrg.set(key, o.id);
  }
  const labelToBranch = new Map<string, string>();
  for (const b of branchRows) {
    labelToBranch.set(b.name.toLowerCase(), b.id);
    labelToBranch.set(b.code.toLowerCase(), b.id);
  }

  const resolved: Record<number, JobRowResolution> = {};

  const rows: ValidatedRow[] = mappedRows.map(({ raw, mapped }, index) => {
    const rowNumber = index + 1;
    const errors: RowError[] = [];

    // Customer.
    let organizationId: string | undefined;
    if (!mapped.customerName) {
      errors.push({ field: "customerName", message: "Customer Name is required" });
    } else if (mapped.gstNumber && gstToOrg.has(normalizeGst(mapped.gstNumber))) {
      organizationId = gstToOrg.get(normalizeGst(mapped.gstNumber));
    } else if (nameToOrg.has(mapped.customerName.toLowerCase())) {
      organizationId = nameToOrg.get(mapped.customerName.toLowerCase());
    } else {
      errors.push({ field: "customerName", message: "No matching customer found — create the customer first" });
    }

    // Branch.
    let branchId: string | undefined;
    if (!mapped.branch) {
      errors.push({ field: "branch", message: "Branch is required" });
    } else if (labelToBranch.has(mapped.branch.toLowerCase())) {
      branchId = labelToBranch.get(mapped.branch.toLowerCase());
    } else {
      errors.push({ field: "branch", message: `No branch matches "${mapped.branch}"` });
    }

    // Shipment type.
    const shipmentType = resolveImportShipmentType(mapped.shipmentType);
    if (!mapped.shipmentType) {
      errors.push({ field: "shipmentType", message: "Shipment Type is required" });
    } else if (!shipmentType) {
      errors.push({ field: "shipmentType", message: `Unrecognised shipment type "${mapped.shipmentType}" (use Import or Export)` });
    }

    // Workflow status.
    const status = resolveImportJobStatus(mapped.workflowStatus);
    if (mapped.workflowStatus && !status) {
      errors.push({ field: "workflowStatus", message: `Unrecognised workflow status "${mapped.workflowStatus}"` });
    }

    // Numeric sanity (only when a value is present).
    for (const key of NUMERIC_KEYS) {
      if (mapped[key] && parseImportNumber(mapped[key]) === null) {
        errors.push({ field: key, message: `"${mapped[key]}" is not a number` });
      }
    }

    const valid = errors.length === 0;
    if (valid && organizationId && branchId && shipmentType && status) {
      resolved[rowNumber] = {
        branchId,
        organizationId,
        shipmentType,
        status,
        serviceTypes: parseImportServiceTypes(mapped.serviceTypes),
      };
    }

    return { rowNumber, raw, mapped, valid, errors };
  });

  return {
    rows,
    validCount: rows.filter((r) => r.valid).length,
    invalidCount: rows.filter((r) => !r.valid).length,
    resolved,
  };
}
