import { z } from "zod";

export const SHIPMENT_TYPE_OPTIONS = [
  { value: "IMPORT", label: "Import" },
  { value: "EXPORT", label: "Export" },
] as const;

export const SERVICE_TYPE_OPTIONS = [
  { value: "FREIGHT_FORWARDING", label: "Freight Forwarding" },
  { value: "CUSTOMS_CLEARANCE", label: "Customs Clearance" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "WAREHOUSING", label: "Warehousing" },
  { value: "EXIM_CONSULTANCY", label: "Exim Consultancy" },
] as const;

export const CARGO_MODE_OPTIONS = [
  { value: "LCL_AIR", label: "LCL & Air" },
  { value: "FCL", label: "FCL" },
] as const;

export const DELIVERY_TYPE_OPTIONS = [
  { value: "LOADED", label: "Loaded" },
  { value: "DESTUFF", label: "Destuff" },
] as const;

export function formatEnquiryRef(createdAt: string | Date, sequenceNumber: number): string {
  const year = new Date(createdAt).getFullYear();
  return `ENQ-${year}-${String(sequenceNumber).padStart(4, "0")}`;
}

const num = z.number().nullable().optional();
const str = z.string().trim().nullable().optional();

// Lenient — every field optional, no cross-field rules. Drafts can be
// incomplete/inconsistent at any time; this is what autosave PATCHes with.
const freightDetailLenient = z.object({
  incoterm: str,
  portOfLoading: str,
  portOfDischarge: str,
  cargoMode: z.enum(["LCL_AIR", "FCL"]).nullable().optional(),
  packageCount: num,
  dimensions: str,
  weight: num,
  fclWeight: num,
  containerType: str,
  containerCount: num,
  isOdc: z.boolean().optional(),
  odcDimensions: str,
  odcPackageCount: num,
  odcPerPackageWeight: num,
});

const customsDetailLenient = z.object({
  hsCode: str,
  commodity: str,
});

const transportDetailLenient = z.object({
  pickup: str,
  destination: str,
  cargoMode: z.enum(["LCL_AIR", "FCL"]).nullable().optional(),
  packageCount: num,
  dimensions: str,
  weight: num,
  fclWeight: num,
  containerType: str,
  deliveryType: z.enum(["LOADED", "DESTUFF"]).nullable().optional(),
  isOdc: z.boolean().optional(),
  odcDimensions: str,
  odcPackageCount: num,
  odcPerPackageWeight: num,
});

export const enquiryAutosaveSchema = z.object({
  branchId: z.string().optional(),
  organizationId: z.string().optional(),
  contactPersonName: str,
  contactPersonPhone: str,
  contactPersonEmail: str,
  shipmentType: z.enum(["IMPORT", "EXPORT"]).nullable().optional(),
  serviceTypes: z
    .array(z.enum(["FREIGHT_FORWARDING", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "WAREHOUSING", "EXIM_CONSULTANCY"]))
    .optional(),
  rfqReason: str,
  freightDetail: freightDetailLenient.optional(),
  customsDetail: customsDetailLenient.optional(),
  transportDetail: transportDetailLenient.optional(),
});

export type EnquiryAutosaveInput = z.infer<typeof enquiryAutosaveSchema>;

// Strict — run only on explicit "Submit Enquiry". Required-ness is keyed off
// serviceTypes via superRefine, so a field required under Freight Forwarding
// is never evaluated unless FREIGHT_FORWARDING is actually selected.
export const enquirySubmitSchema = enquiryAutosaveSchema
  .extend({
    shipmentType: z.enum(["IMPORT", "EXPORT"]),
    rfqReason: z.string().trim().min(1, "RFQ reason is required"),
    serviceTypes: z
      .array(z.enum(["FREIGHT_FORWARDING", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "WAREHOUSING", "EXIM_CONSULTANCY"]))
      .min(1, "Select at least one service type"),
  })
  .superRefine((data, ctx) => {
    const serviceTypes = data.serviceTypes;

    if (serviceTypes.includes("FREIGHT_FORWARDING")) {
      const d = data.freightDetail;
      if (!d) {
        ctx.addIssue({ code: "custom", path: ["freightDetail"], message: "Freight Forwarding details are required" });
      } else {
        if (!d.incoterm) ctx.addIssue({ code: "custom", path: ["freightDetail", "incoterm"], message: "Incoterm is required" });
        if (!d.portOfLoading)
          ctx.addIssue({ code: "custom", path: ["freightDetail", "portOfLoading"], message: "Port of Loading is required" });
        if (!d.portOfDischarge)
          ctx.addIssue({ code: "custom", path: ["freightDetail", "portOfDischarge"], message: "Port of Discharge is required" });
        if (!d.cargoMode) {
          ctx.addIssue({ code: "custom", path: ["freightDetail", "cargoMode"], message: "Select LCL & Air or FCL" });
        } else if (d.cargoMode === "LCL_AIR") {
          if (d.packageCount == null)
            ctx.addIssue({ code: "custom", path: ["freightDetail", "packageCount"], message: "No. of Packages is required" });
          if (!d.dimensions)
            ctx.addIssue({ code: "custom", path: ["freightDetail", "dimensions"], message: "Dimensions are required" });
          if (d.weight == null)
            ctx.addIssue({ code: "custom", path: ["freightDetail", "weight"], message: "Weight is required" });
        } else if (d.cargoMode === "FCL") {
          if (d.fclWeight == null)
            ctx.addIssue({ code: "custom", path: ["freightDetail", "fclWeight"], message: "Weight is required" });
          if (!d.containerType)
            ctx.addIssue({ code: "custom", path: ["freightDetail", "containerType"], message: "Container Type is required" });
          if (d.containerCount == null)
            ctx.addIssue({
              code: "custom",
              path: ["freightDetail", "containerCount"],
              message: "No. of Containers is required",
            });
          if (d.isOdc) {
            if (!d.odcDimensions)
              ctx.addIssue({
                code: "custom",
                path: ["freightDetail", "odcDimensions"],
                message: "ODC Dimensions are required",
              });
            if (d.odcPackageCount == null)
              ctx.addIssue({
                code: "custom",
                path: ["freightDetail", "odcPackageCount"],
                message: "ODC No. of Packages is required",
              });
            if (d.odcPerPackageWeight == null)
              ctx.addIssue({
                code: "custom",
                path: ["freightDetail", "odcPerPackageWeight"],
                message: "ODC Per Package Weight is required",
              });
          }
        }
      }
    }

    if (serviceTypes.includes("CUSTOMS_CLEARANCE")) {
      const d = data.customsDetail;
      if (!d) {
        ctx.addIssue({ code: "custom", path: ["customsDetail"], message: "Customs Clearance details are required" });
      } else {
        if (!d.hsCode) ctx.addIssue({ code: "custom", path: ["customsDetail", "hsCode"], message: "HS Code is required" });
        if (!d.commodity)
          ctx.addIssue({ code: "custom", path: ["customsDetail", "commodity"], message: "Commodity is required" });
      }
    }

    if (serviceTypes.includes("TRANSPORTATION")) {
      const d = data.transportDetail;
      if (!d) {
        ctx.addIssue({ code: "custom", path: ["transportDetail"], message: "Transportation details are required" });
      } else {
        if (!d.pickup) ctx.addIssue({ code: "custom", path: ["transportDetail", "pickup"], message: "Pickup is required" });
        if (!d.destination)
          ctx.addIssue({ code: "custom", path: ["transportDetail", "destination"], message: "Destination is required" });
        if (!d.cargoMode) {
          ctx.addIssue({ code: "custom", path: ["transportDetail", "cargoMode"], message: "Select LCL & Air or FCL" });
        } else if (d.cargoMode === "LCL_AIR") {
          if (d.packageCount == null)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "packageCount"], message: "No. of Packages is required" });
          if (!d.dimensions)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "dimensions"], message: "Dimensions are required" });
          if (d.weight == null)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "weight"], message: "Weight is required" });
        } else if (d.cargoMode === "FCL") {
          // Note: Transportation's FCL block has no container-count field, unlike Freight Forwarding's.
          if (d.fclWeight == null)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "fclWeight"], message: "Weight is required" });
          if (!d.containerType)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "containerType"], message: "Container Type is required" });
          if (!d.deliveryType)
            ctx.addIssue({ code: "custom", path: ["transportDetail", "deliveryType"], message: "Delivery Type is required" });
          if (d.isOdc) {
            if (!d.odcDimensions)
              ctx.addIssue({
                code: "custom",
                path: ["transportDetail", "odcDimensions"],
                message: "ODC Dimensions are required",
              });
            if (d.odcPackageCount == null)
              ctx.addIssue({
                code: "custom",
                path: ["transportDetail", "odcPackageCount"],
                message: "ODC No. of Packages is required",
              });
            if (d.odcPerPackageWeight == null)
              ctx.addIssue({
                code: "custom",
                path: ["transportDetail", "odcPerPackageWeight"],
                message: "ODC Per Package Weight is required",
              });
          }
        }
      }
    }
  });
