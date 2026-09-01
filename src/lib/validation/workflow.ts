import { z } from "zod";
import { ROLES } from "@/lib/permissions/roles";

// ---------------------------------------------------------------------------
// Stage 5 — per-step data capture + route payload schemas.
//
// Most steps record a single date + optional note. A few carry structured
// fields (HBL No./Date, MBL No./Date, the 9 Freight Certificate figures).
// The field list per step drives both the UI (StepDetailCard renders it) and
// server validation. Lenient on "save" (draft), strict (required fields
// enforced) on "complete" — mirrors jobAutosaveSchema vs jobSubmitSchema.
// Step data is stored opaque on JobWorkflowProgress.data (like Job.charges);
// this is the single source of truth for its shape.
// ---------------------------------------------------------------------------

export type StepFieldType = "date" | "text" | "number";

export interface StepFieldDef {
  key: string;
  label: string;
  type: StepFieldType;
  required?: boolean;
  // Prefill from the Job when the step has no saved data yet (Freight
  // Certificate reuses Shipper/Consignee/port values already on the Job).
  prefillFrom?: "shipperName" | "consigneeName" | "portOfLoading" | "portOfDischarge";
}

const DATE: StepFieldDef = { key: "date", label: "Date", type: "date", required: true };
const NOTE: StepFieldDef = { key: "note", label: "Note", type: "text" };

// Steps not listed here use [DATE, NOTE].
export const WORKFLOW_STEP_FIELDS: Record<string, StepFieldDef[]> = {
  so_details: [
    { key: "soNumber", label: "SO Number", type: "text", required: true },
    { key: "date", label: "SO Date", type: "date", required: true },
    NOTE,
  ],
  onboard_hbl_details: [
    { key: "hblNumber", label: "HBL No.", type: "text", required: true },
    { key: "hblDate", label: "HBL Date", type: "date", required: true },
    NOTE,
  ],
  mbl_details: [
    { key: "mblNumber", label: "MBL No.", type: "text", required: true },
    { key: "mblDate", label: "MBL Date", type: "date", required: true },
    NOTE,
  ],
  freight_certificate_prep: [
    { key: "certificateDate", label: "Certificate Date", type: "date", required: true },
    { key: "shipperName", label: "Shipper Name", type: "text", required: true, prefillFrom: "shipperName" },
    { key: "consigneeName", label: "Consignee Name", type: "text", required: true, prefillFrom: "consigneeName" },
    { key: "portOfLoading", label: "Port of Loading", type: "text", required: true, prefillFrom: "portOfLoading" },
    { key: "portOfDischarge", label: "Port of Discharge", type: "text", required: true, prefillFrom: "portOfDischarge" },
    { key: "hblNumberDate", label: "HBL No. & Date", type: "text", required: true },
    { key: "mblNumberDate", label: "MBL No. & Date", type: "text", required: true },
    { key: "oceanFreightUsd", label: "Ocean Freight (USD)", type: "number", required: true },
    { key: "exWorksUsd", label: "Ex-Works (USD)", type: "number", required: true },
    NOTE,
  ],
  igm_status: [
    { key: "status", label: "IGM Status", type: "text", required: true },
    DATE,
    NOTE,
  ],
  customs_clearance_status: [
    { key: "status", label: "Customs Clearance Status", type: "text", required: true },
    DATE,
    NOTE,
  ],
  delivered_status: [
    { key: "status", label: "Delivered Status", type: "text", required: true },
    { key: "date", label: "Delivery Confirmed Date", type: "date", required: true },
    NOTE,
  ],
};

export function stepFieldDefs(stepKey: string): StepFieldDef[] {
  return WORKFLOW_STEP_FIELDS[stepKey] ?? [DATE, NOTE];
}

export interface StepFieldIssue {
  field: string;
  message: string;
}

// Coerces + validates a raw step-data object against its field list.
// Unknown keys are dropped. Hand-rolled (not zod) because the schema is
// per-stepKey dynamic and the shape is flat key/value — same precedent as
// the bulk-import row validators.
export function validateStepData(
  stepKey: string,
  raw: unknown,
  opts: { strict: boolean },
): { ok: true; data: Record<string, unknown> } | { ok: false; issues: StepFieldIssue[] } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const issues: StepFieldIssue[] = [];

  for (const f of stepFieldDefs(stepKey)) {
    let v: unknown = input[f.key];
    if (typeof v === "string") v = v.trim();
    const empty = v === undefined || v === null || v === "";

    if (empty) {
      if (opts.strict && f.required) issues.push({ field: f.key, message: `${f.label} is required` });
      continue;
    }

    if (f.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) {
        issues.push({ field: f.key, message: `${f.label} must be a number` });
        continue;
      }
      out[f.key] = n;
    } else {
      out[f.key] = v as string;
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, data: out };
}

// ---------------------------------------------------------------------------
// Route payload schemas
// ---------------------------------------------------------------------------

export const STEP_ACTIONS = ["save", "complete", "submit", "approve", "reject", "revert"] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export const stepActionSchema = z.object({
  action: z.enum(STEP_ACTIONS),
  data: z.record(z.string(), z.unknown()).optional(),
  note: z.string().trim().optional(),
});

const roleEnum = z.enum(ROLES);

// One entry in the admin template PATCH's `steps[]` array. No `id` => insert
// a new step (stepKey + label + sortOrder + ownerRole required). With `id` =>
// update that step in place. Omitted existing steps are left untouched;
// there is no delete (set isActive:false instead).
export const templateStepPatchSchema = z.object({
  id: z.string().optional(),
  stepKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores only")
    .optional(),
  label: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  ownerRole: roleEnum.optional(),
  approverRole: roleEnum.nullable().optional(),
  isApprovalGate: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const templatePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(templateStepPatchSchema).optional(),
});

export type TemplateStepPatch = z.infer<typeof templateStepPatchSchema>;
