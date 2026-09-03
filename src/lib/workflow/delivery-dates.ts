// Stage 10b — derives Job.expectedDeliveryDate / Job.actualDeliveryDate from
// workflow-step data. Pure (no IO); mirrors the shape of build-document-data.ts.
// The workflow step route calls this on each save/complete and applies the patch.
//
//   expectedDeliveryDate  <- the ETA-at-POD step's `data.date`
//                            (import: eta_discharge_port, export: export_eta_to_pod)
//   actualDeliveryDate    <- the delivery step's `data.date`
//                            (import: delivered_status [also isFinal],
//                             export: export_do_and_delivery [isFinal is
//                             export_bill_preparation, which has no clean
//                             delivery date — see the isFinal fallback below])

import type { ShipmentType } from "@/generated/prisma/client";

export const DELIVERY_STEP_KEYS: Record<
  ShipmentType,
  { expected: string; actual: string }
> = {
  IMPORT: { expected: "eta_discharge_port", actual: "delivered_status" },
  EXPORT: { expected: "export_eta_to_pod", actual: "export_do_and_delivery" },
};

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export interface DeliveryDatePatch {
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
}

/**
 * Returns the Job field patch implied by completing/saving one workflow step.
 * The patch is always safe to spread into a `job.update({ data })`:
 *  - `expectedDeliveryDate` is set only from the ETA-at-POD step.
 *  - `actualDeliveryDate` is set authoritatively from the delivery step, or —
 *    only when it is not already recorded — as a fallback when the job's final
 *    step completes (an export whose `export_do_and_delivery` was skipped).
 */
export function deliveryDatePatchForStep(args: {
  shipmentType: ShipmentType;
  stepKey: string;
  stepData: Record<string, unknown> | null | undefined;
  isFinal: boolean;
  currentActualDeliveryDate?: Date | null;
}): DeliveryDatePatch {
  const { shipmentType, stepKey, stepData, isFinal, currentActualDeliveryDate } = args;
  const keys = DELIVERY_STEP_KEYS[shipmentType];
  const patch: DeliveryDatePatch = {};
  const parsed = parseDate(stepData?.["date"]);

  if (stepKey === keys.expected && parsed) {
    patch.expectedDeliveryDate = parsed;
  }

  if (stepKey === keys.actual) {
    patch.actualDeliveryDate = parsed ?? new Date();
  } else if (isFinal && !currentActualDeliveryDate) {
    patch.actualDeliveryDate = parsed ?? new Date();
  }

  return patch;
}

/** True when the patch has at least one field to write. */
export function hasDeliveryDatePatch(p: DeliveryDatePatch): boolean {
  return p.expectedDeliveryDate !== undefined || p.actualDeliveryDate !== undefined;
}
