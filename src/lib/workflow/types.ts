import type { Role } from "@/lib/permissions/roles";
import type { ExportStuffingType, ShipmentType } from "@/generated/prisma/client";

// Shared track-definition shapes for both import-tracks.ts and
// export-tracks.ts, plus the template-lookup-key computation. Kept separate
// from import-tracks.ts so export-tracks.ts doesn't import from a same-level
// "import" module.

export interface WorkflowStepDef {
  stepKey: string;
  label: string;
  ownerRole: Role;
  approverRole?: Role;
  isSkippable?: boolean; // Stage 6 "if required" steps (e.g. Empty Yard Amendment)
  // isApprovalGate / isFinal / sortOrder / isActive are derived at seed time.
}

export interface WorkflowTemplateDef {
  name: string;
  shipmentType: "IMPORT" | "EXPORT";
  incotermKey: string;
  steps: WorkflowStepDef[];
}

// Job.incoterm is free-text; this is the bucket key matched against
// WorkflowTemplate.incotermKey.
export function normalizeIncotermKey(incoterm: string | null | undefined): string {
  return (incoterm ?? "").trim().toUpperCase();
}

const STUFFING_KEY_SUFFIX: Record<ExportStuffingType, string> = {
  NONE: "",
  DOCK: "-DOCK",
  FACTORY: "-FACTORY",
};

/**
 * WorkflowTemplate is uniquely keyed on a single incotermKey string, but
 * Export needs a second dimension (stuffing type). That's folded in as a key
 * suffix ("CIF-DOCK") rather than a new column, so the unique constraint and
 * the admin template screen/route need no changes. Returns lookup candidates
 * most-specific first — e.g. ["CIF-DOCK", "CIF"] — so attachWorkflow can fall
 * back to the plain incoterm track if a stuffing-specific template has been
 * deactivated. Import always returns a single bare key (bit-identical to
 * Stage 5's behavior).
 */
export function templateLookupKeys(job: {
  shipmentType: ShipmentType;
  incoterm: string | null;
  exportStuffingType?: ExportStuffingType | null;
}): string[] {
  const base = normalizeIncotermKey(job.incoterm);
  if (!base) return [];
  if (job.shipmentType !== "EXPORT") return [base];

  const suffix = STUFFING_KEY_SUFFIX[job.exportStuffingType ?? "NONE"];
  return suffix ? [`${base}${suffix}`, base] : [base];
}
