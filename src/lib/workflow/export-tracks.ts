import type { WorkflowStepDef, WorkflowTemplateDef } from "./types";

// Stage 6 — the Export workflow tracks as data (seeded into WorkflowTemplate
// / WorkflowStep by prisma/seed.ts, admin-editable afterward), mirroring
// import-tracks.ts's pattern exactly. Source: docs/original-process-reference.pdf
// page 5-6 and docs/platform-development-plan.md §5.7-5.8.
//
// 9 templates = 3 Incoterms (CIF/DDP/DDU) x 3 stuffing variants (none/Dock/
// Factory), composed from 4 reusable step arrays + 2 duty-step variants so
// shared steps physically cannot drift between tracks — same precedent as
// EXW -> FOB in import-tracks.ts.
//
// Deviation from the plan doc's prose (documented per stage-6.md): §5.7's
// shared-steps sentence lists "Bill Preparation (Accounts)" before "ETA to
// POD", but the source PDF table places Bill Preparation last in every
// column, and its two sub-dates ("once sail from POL", "once vessel arrived
// at POD") require ETA to POD to already have happened — so Bill Preparation
// is last here, and is each template's isFinal step.
//
// CIF was confirmed to carry the same backbone as DDP/DDU minus the Duty
// Payment step (not the PDF table's shorter 8-row reading) — stage-6.md
// decision #1.

const EXPORT_PRE_STUFFING_STEPS: WorkflowStepDef[] = [
  { stepKey: "export_booking_confirmation", label: "Booking Confirmation", ownerRole: "DOER" },
  { stepKey: "export_vessel_cutoff_details", label: "Vessel Cutoff Details", ownerRole: "DOER" },
  { stepKey: "export_si_filing", label: "SI Filing", ownerRole: "DOER" },
  { stepKey: "export_form13_approval", label: "Form-13 Approval", ownerRole: "DOER" },
  {
    stepKey: "export_empty_yard_amendment",
    label: "Empty Yard Amendment (if required)",
    ownerRole: "DOER",
    isSkippable: true,
  },
];

const EXPORT_DOCK_STUFFING_STEPS: WorkflowStepDef[] = [
  { stepKey: "export_dock_pickup_from_shipper", label: "Pickup Cargo from Shipper Factory", ownerRole: "DOER" },
  { stepKey: "export_dock_vehicle_arrived_unload_cfs", label: "Vehicle Arrived & Unloaded at CFS", ownerRole: "DOER" },
  {
    stepKey: "export_dock_empty_container_instruction",
    label: "Empty Container Pickup Instruction to CFS",
    ownerRole: "DOER",
  },
  { stepKey: "export_dock_customs_clearance_cfs", label: "Customs Clearance at CFS", ownerRole: "DOER" },
  { stepKey: "export_dock_stuffing_at_cfs", label: "Stuffing at CFS", ownerRole: "DOER" },
  { stepKey: "export_dock_movement_instruction", label: "Instruction to CFS for Movement", ownerRole: "DOER" },
];

const EXPORT_FACTORY_STUFFING_STEPS: WorkflowStepDef[] = [
  {
    stepKey: "export_factory_empty_container_pickup",
    label: "Pickup Empty Container (per Gate Opening Date)",
    ownerRole: "DOER",
  },
  { stepKey: "export_factory_stuffing_at_plant", label: "Stuffing at Plant", ownerRole: "DOER" },
  { stepKey: "export_factory_customs_clearance", label: "Customs Clearance", ownerRole: "DOER" },
  { stepKey: "export_factory_handover_at_port", label: "Handover at Port", ownerRole: "DOER" },
];

const EXPORT_POST_STUFFING_STEPS: WorkflowStepDef[] = [
  { stepKey: "export_bl_type", label: "BL Type Selection", ownerRole: "DOER" },
  {
    stepKey: "export_bl_release",
    label: "BL Release",
    ownerRole: "DOER",
    approverRole: "BRANCH_MANAGER",
  },
  { stepKey: "export_eta_to_pod", label: "ETA to POD", ownerRole: "DOER" },
  { stepKey: "export_customs_clearance_pod", label: "Customs Clearance", ownerRole: "DOER" },
  { stepKey: "export_do_and_delivery", label: "DO & Delivery", ownerRole: "DOER" },
  { stepKey: "export_bill_preparation", label: "Bill Preparation", ownerRole: "ACCOUNTS" },
];

const DUTY_PAYMENT_STEP: WorkflowStepDef = {
  stepKey: "export_duty_payment",
  label: "Duty Payment",
  ownerRole: "ACCOUNTS",
};

const DUTY_PAYMENT_CONSIGNEE_STEP: WorkflowStepDef = {
  stepKey: "export_duty_payment_consignee",
  label: "Duty Payment — in Consignee Account",
  ownerRole: "ACCOUNTS",
};

// Insert the duty step (if any) right before "DO & Delivery", found by key
// (not index) so reordering the post-stuffing block above can't silently
// move it.
function postStuffingSteps(duty: WorkflowStepDef | null): WorkflowStepDef[] {
  if (!duty) return EXPORT_POST_STUFFING_STEPS;
  const out = [...EXPORT_POST_STUFFING_STEPS];
  const insertAt = out.findIndex((s) => s.stepKey === "export_do_and_delivery");
  out.splice(insertAt, 0, duty);
  return out;
}

const STUFFING_VARIANTS = [
  { keySuffix: "", nameSuffix: "", steps: [] as WorkflowStepDef[] },
  { keySuffix: "-DOCK", nameSuffix: " — Dock Stuffing", steps: EXPORT_DOCK_STUFFING_STEPS },
  { keySuffix: "-FACTORY", nameSuffix: " — Factory Stuffing", steps: EXPORT_FACTORY_STUFFING_STEPS },
] as const;

const INCOTERM_VARIANTS = [
  { key: "CIF", name: "Export — CIF", duty: null },
  { key: "DDP", name: "Export — DDP", duty: DUTY_PAYMENT_STEP },
  { key: "DDU", name: "Export — DDU", duty: DUTY_PAYMENT_CONSIGNEE_STEP },
] as const;

export const EXPORT_WORKFLOW_TEMPLATES: WorkflowTemplateDef[] = INCOTERM_VARIANTS.flatMap((inco) =>
  STUFFING_VARIANTS.map((st) => ({
    name: `${inco.name}${st.nameSuffix}`,
    shipmentType: "EXPORT" as const,
    incotermKey: `${inco.key}${st.keySuffix}`,
    steps: [...EXPORT_PRE_STUFFING_STEPS, ...st.steps, ...postStuffingSteps(inco.duty)],
  })),
);

// Used by the verification script to iterate the 3 base Incoterm keys.
export const EXPORT_INCOTERM_KEYS = ["CIF", "DDP", "DDU"] as const;
