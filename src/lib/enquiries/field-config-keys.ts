import type { EnquiryAutosaveInput } from "@/lib/validation/enquiry";

// Client-safe half of the field-config module — no Prisma import, so this
// can be imported from "use client" components (the admin settings manager)
// as well as server code. field-config.ts (the DB-backed half) re-exports
// everything here alongside getEnquiryFieldConfigMap.

// Canonical list of admin-configurable fields — a curated set of the
// top-level, always-rendered fields per service type. Deliberately excludes:
// finalDestinationAddress (its incoterm-conditional, never-mandatory rule is
// a fixed business rule, not admin-tunable), the ODC sub-fields (already
// self-gated behind the isOdc checkbox), and per-line hsCode/commodity
// (whether a line is complete is a structural rule, not a visibility toggle
// — only "must at least one line exist" is configurable, via commodityLines).
export const ENQUIRY_FIELD_KEYS = [
  { serviceType: "FREIGHT_FORWARDING", fieldKey: "incoterm", label: "Incoterm" },
  { serviceType: "FREIGHT_FORWARDING", fieldKey: "portOfLoadingId", label: "Port of Loading" },
  { serviceType: "FREIGHT_FORWARDING", fieldKey: "portOfDischargeId", label: "Port of Discharge" },
  { serviceType: "FREIGHT_FORWARDING", fieldKey: "cargoMode", label: "Cargo Mode" },
  { serviceType: "FREIGHT_FORWARDING", fieldKey: "packages", label: "Packages / Containers (at least one)" },
  { serviceType: "CUSTOMS_CLEARANCE", fieldKey: "commodityLines", label: "HS Code / Commodity lines (at least one)" },
  { serviceType: "TRANSPORTATION", fieldKey: "pickup", label: "Pickup" },
  { serviceType: "TRANSPORTATION", fieldKey: "destination", label: "Destination" },
  { serviceType: "TRANSPORTATION", fieldKey: "cargoMode", label: "Cargo Mode" },
  { serviceType: "TRANSPORTATION", fieldKey: "packageCount", label: "No. of Packages (LCL & Air)" },
  { serviceType: "TRANSPORTATION", fieldKey: "containerType", label: "Container Type (FCL)" },
  { serviceType: "TRANSPORTATION", fieldKey: "deliveryType", label: "Delivery Type (FCL)" },
] as const;

export interface FieldConfigEntry {
  isVisible: boolean;
  isRequired: boolean;
}

// serviceType -> fieldKey -> entry. A key absent from the DB defaults to
// {isVisible: true, isRequired: true} — today's hardcoded behavior.
export type FieldConfigMap = Record<string, Record<string, FieldConfigEntry>>;

export const DEFAULT_FIELD_CONFIG_ENTRY: FieldConfigEntry = { isVisible: true, isRequired: true };

// A hidden field can never block submission, regardless of its stored
// isRequired value — this is the single source of truth for "effectively
// required" used by both the submit-time checker below and (indirectly) the
// form, which only ever renders a field it also validates against.
function isEffectivelyRequired(map: FieldConfigMap, serviceType: string, fieldKey: string): boolean {
  const cfg = map[serviceType]?.[fieldKey] ?? DEFAULT_FIELD_CONFIG_ENTRY;
  return cfg.isVisible && cfg.isRequired;
}

export interface FieldRequirementIssue {
  path: (string | number)[];
  message: string;
}

// Config-driven counterpart to enquirySubmitSchema's superRefine — the
// per-field required checks that used to be hardcoded there now look up
// admin-set requiredness here instead. Structural checks (a service type's
// detail object must exist at all, ODC sub-fields when isOdc is checked, a
// commodity line's hsCode/commodity both being filled) stay in the Zod
// schema since they aren't part of the configurable set.
export function checkConfigurableFieldRequirements(
  data: Pick<EnquiryAutosaveInput, "serviceTypes" | "freightDetail" | "customsDetail" | "transportDetail">,
  configMap: FieldConfigMap,
): FieldRequirementIssue[] {
  const issues: FieldRequirementIssue[] = [];
  const serviceTypes = data.serviceTypes ?? [];
  const required = (serviceType: string, fieldKey: string) => isEffectivelyRequired(configMap, serviceType, fieldKey);

  if (serviceTypes.includes("FREIGHT_FORWARDING")) {
    const d = data.freightDetail;
    if (required("FREIGHT_FORWARDING", "incoterm") && !d?.incoterm)
      issues.push({ path: ["freightDetail", "incoterm"], message: "Incoterm is required" });
    if (required("FREIGHT_FORWARDING", "portOfLoadingId") && !d?.portOfLoadingId)
      issues.push({ path: ["freightDetail", "portOfLoadingId"], message: "Port of Loading is required" });
    if (required("FREIGHT_FORWARDING", "portOfDischargeId") && !d?.portOfDischargeId)
      issues.push({ path: ["freightDetail", "portOfDischargeId"], message: "Port of Discharge is required" });
    if (required("FREIGHT_FORWARDING", "cargoMode") && !d?.cargoMode)
      issues.push({ path: ["freightDetail", "cargoMode"], message: "Select LCL & Air or FCL" });
    if (required("FREIGHT_FORWARDING", "packages") && (d?.packages?.length ?? 0) < 1)
      issues.push({ path: ["freightDetail", "packages"], message: "Add at least one package" });
  }

  if (serviceTypes.includes("CUSTOMS_CLEARANCE")) {
    if (required("CUSTOMS_CLEARANCE", "commodityLines") && (data.customsDetail?.commodityLines?.length ?? 0) < 1)
      issues.push({ path: ["customsDetail", "commodityLines"], message: "Add at least one HS Code / Commodity line" });
  }

  if (serviceTypes.includes("TRANSPORTATION")) {
    const d = data.transportDetail;
    if (required("TRANSPORTATION", "pickup") && !d?.pickup)
      issues.push({ path: ["transportDetail", "pickup"], message: "Pickup is required" });
    if (required("TRANSPORTATION", "destination") && !d?.destination)
      issues.push({ path: ["transportDetail", "destination"], message: "Destination is required" });
    if (required("TRANSPORTATION", "cargoMode") && !d?.cargoMode)
      issues.push({ path: ["transportDetail", "cargoMode"], message: "Select LCL & Air or FCL" });
    if (d?.cargoMode === "LCL_AIR" && required("TRANSPORTATION", "packageCount") && d.packageCount == null)
      issues.push({ path: ["transportDetail", "packageCount"], message: "No. of Packages is required" });
    if (d?.cargoMode === "FCL") {
      if (required("TRANSPORTATION", "containerType") && !d.containerType)
        issues.push({ path: ["transportDetail", "containerType"], message: "Container Type is required" });
      if (required("TRANSPORTATION", "deliveryType") && !d.deliveryType)
        issues.push({ path: ["transportDetail", "deliveryType"], message: "Delivery Type is required" });
    }
  }

  return issues;
}
