import type { WorkflowStepDef, WorkflowTemplateDef } from "./types";

// Stage 5 — the two Import workflow tracks as data (seeded into
// WorkflowTemplate / WorkflowStep by prisma/seed.ts, admin-editable
// afterward). Source: docs/original-process-reference.pdf pages 3-4 and
// docs/platform-development-plan.md §5.5-5.6.
//
// Owner is DOER unless noted. The only two-actor approval gate is Draft HBL
// Checking & Approval (owner DOER -> approver BRANCH_MANAGER). Freight
// Certificate Preparation and Bill Preparation are Accounts-owned single
// steps (no separate approver) — see stage-5.md decision #2.

// Import — Ex-Works track, 17 steps. The FOB track (§5.6) is this list minus
// "container_pickup_date", renumbered — derived below so the shared steps
// never drift between the two.
const IMPORT_EXWORKS_STEPS: WorkflowStepDef[] = [
  { stepKey: "etd_from_pol", label: "ETD from POL", ownerRole: "DOER" },
  { stepKey: "so_details", label: "SO Details", ownerRole: "DOER" },
  { stepKey: "container_pickup_date", label: "Container Pickup Date", ownerRole: "DOER" },
  { stepKey: "cargo_loading_date", label: "Cargo Loading Date", ownerRole: "DOER" },
  {
    stepKey: "draft_hbl_approval",
    label: "Draft HBL Checking & Approval",
    ownerRole: "DOER",
    approverRole: "BRANCH_MANAGER",
  },
  { stepKey: "handover_at_port", label: "Handover at Port", ownerRole: "DOER" },
  { stepKey: "onboard_hbl_details", label: "On-Board HBL Details", ownerRole: "DOER" },
  { stepKey: "vessel_sail_date", label: "Vessel Sail Date", ownerRole: "DOER" },
  { stepKey: "mbl_details", label: "MBL Details", ownerRole: "DOER" },
  { stepKey: "freight_certificate_prep", label: "Freight Certificate Preparation", ownerRole: "ACCOUNTS" },
  { stepKey: "eta_discharge_port", label: "ETA to discharge port", ownerRole: "DOER" },
  { stepKey: "igm_status", label: "IGM Status", ownerRole: "DOER" },
  { stepKey: "bill_preparation", label: "Bill Preparation: As per Quotation", ownerRole: "ACCOUNTS" },
  { stepKey: "delivery_order_release", label: "Delivery Order Release", ownerRole: "DOER" },
  { stepKey: "customs_clearance_status", label: "Customs Clearance Status", ownerRole: "DOER" },
  { stepKey: "delivery_date", label: "Delivery Date", ownerRole: "DOER" },
  { stepKey: "delivered_status", label: "Delivered Status", ownerRole: "DOER" },
];

const IMPORT_FOB_STEPS: WorkflowStepDef[] = IMPORT_EXWORKS_STEPS.filter(
  (s) => s.stepKey !== "container_pickup_date",
);

export const IMPORT_WORKFLOW_TEMPLATES: WorkflowTemplateDef[] = [
  { name: "Import — Ex-Works", shipmentType: "IMPORT", incotermKey: "EXW", steps: IMPORT_EXWORKS_STEPS },
  { name: "Import — FOB", shipmentType: "IMPORT", incotermKey: "FOB", steps: IMPORT_FOB_STEPS },
];

// Note: "delivered_status" (the last step above) completes the Job via
// WorkflowStep.isFinal (seeded as the last step of every template) — see
// prisma/seed.ts. Only EXW and FOB are seeded for Import — any other Import
// Incoterm attaches no workflow (stage-5.md decision #1).
