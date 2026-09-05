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

export const DIMENSION_UNIT_OPTIONS = [
  { value: "MM", label: "mm" },
  { value: "CM", label: "cm" },
  { value: "IN", label: "in" },
  { value: "FT", label: "ft" },
  { value: "M", label: "m" },
] as const;

// Incoterms whose Freight Forwarding detail shows the Final Destination
// Address field. Never mandatory even when shown.
export const FINAL_DESTINATION_ADDRESS_INCOTERMS = ["EXW", "DDP", "DDU", "DAP"] as const;

// Unified reference: prefer the stored RFQ-DDMMYY-NNNN string; fall back to the
// legacy computed ENQ-YYYY-NNNN for rows created before the reference backfill.
export function formatEnquiryRef(row: {
  referenceNo?: string | null;
  createdAt: string | Date;
  sequenceNumber: number;
}): string {
  if (row.referenceNo) return row.referenceNo;
  const year = new Date(row.createdAt).getFullYear();
  return `ENQ-${year}-${String(row.sequenceNumber).padStart(4, "0")}`;
}

const num = z.number().nullable().optional();
const str = z.string().trim().nullable().optional();

// One row per package (LCL & Air) or per container *type* (FCL — Stage 14a:
// container type + how many + weight per container; no L/W/H). All fields
// optional — dims and weight are never mandatory.
const packageLenient = z.object({
  length: num,
  width: num,
  height: num,
  dimensionUnit: z.enum(["MM", "CM", "IN", "FT", "M"]).nullable().optional(),
  weight: num,
  containerType: str,
  numberOfContainers: num,
});

const commodityLineLenient = z.object({
  hsCode: str,
  commodity: str,
});

// Lenient — every field optional, no cross-field rules. Drafts can be
// incomplete/inconsistent at any time; this is what autosave PATCHes with.
const freightDetailLenient = z.object({
  incoterm: str,
  portOfLoadingId: str,
  portOfDischargeId: str,
  // Only relevant when incoterm is one of FINAL_DESTINATION_ADDRESS_INCOTERMS;
  // never mandatory either way. Labelled "Pickup Address" for EXW, "Final
  // Destination Address" otherwise (Stage 14a — relabel only, same column).
  finalDestinationAddress: str,
  cargoMode: z.enum(["LCL_AIR", "FCL"]).nullable().optional(),
  packages: z.array(packageLenient).optional(),
});

const customsDetailLenient = z.object({
  commodityLines: z.array(commodityLineLenient).optional(),
});

const transportDetailLenient = z.object({
  pickup: str,
  destination: str,
  cargoMode: z.enum(["LCL_AIR", "FCL"]).nullable().optional(),
  packageCount: num,
  length: num,
  width: num,
  height: num,
  dimensionUnit: z.enum(["MM", "CM", "IN", "FT", "M"]).nullable().optional(),
  weight: num,
  fclWeight: num,
  containerType: str,
  deliveryType: z.enum(["LOADED", "DESTUFF"]).nullable().optional(),
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

// Strict — run only on explicit "Submit Enquiry". Structural only: a selected
// service type's detail object must exist, and each Customs commodity line that
// exists must have both hsCode and commodity filled. Everything else —
// Incoterm, ports, cargo mode, "at least one package/commodity line",
// Transportation's pickup/destination/etc — moved to
// src/lib/enquiries/field-config.ts's checkConfigurableFieldRequirements,
// which the submit route runs after this schema passes, so admin-set
// per-service-type requiredness (Stage 12c) is enforced server-side too.
// (ODC was removed in Stage 14a — no ODC checks remain here.)
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
      if (!data.freightDetail) {
        ctx.addIssue({ code: "custom", path: ["freightDetail"], message: "Freight Forwarding details are required" });
      }
    }

    if (serviceTypes.includes("CUSTOMS_CLEARANCE")) {
      const d = data.customsDetail;
      if (!d) {
        ctx.addIssue({ code: "custom", path: ["customsDetail"], message: "Customs Clearance details are required" });
      } else {
        d.commodityLines?.forEach((line, index) => {
          if (!line.hsCode)
            ctx.addIssue({
              code: "custom",
              path: ["customsDetail", "commodityLines", index, "hsCode"],
              message: "HS Code is required",
            });
          if (!line.commodity)
            ctx.addIssue({
              code: "custom",
              path: ["customsDetail", "commodityLines", index, "commodity"],
              message: "Commodity is required",
            });
        });
      }
    }

    if (serviceTypes.includes("TRANSPORTATION")) {
      if (!data.transportDetail) {
        ctx.addIssue({ code: "custom", path: ["transportDetail"], message: "Transportation details are required" });
      }
    }
  });
