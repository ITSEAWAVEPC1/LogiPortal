import { prisma } from "@/lib/db/prisma";
import { DEFAULT_FIELD_CONFIG_ENTRY, ENQUIRY_FIELD_KEYS, type FieldConfigMap } from "./field-config-keys";

export * from "./field-config-keys";

export async function getEnquiryFieldConfigMap(): Promise<FieldConfigMap> {
  const rows = await prisma.enquiryFieldConfig.findMany();
  const map: FieldConfigMap = {};
  for (const { serviceType, fieldKey } of ENQUIRY_FIELD_KEYS) {
    map[serviceType] ??= {};
    map[serviceType][fieldKey] = { ...DEFAULT_FIELD_CONFIG_ENTRY };
  }
  for (const row of rows) {
    map[row.serviceType] ??= {};
    map[row.serviceType][row.fieldKey] = { isVisible: row.isVisible, isRequired: row.isRequired };
  }
  return map;
}
