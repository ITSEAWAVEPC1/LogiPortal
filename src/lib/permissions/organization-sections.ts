import { getFieldAccessMap } from "./field-permissions";
import type { Role } from "./roles";
import type { OrganizationSectionPermissions } from "@/lib/organizations/write-organization-children";

// Section 4.3-style field groups for the "organization" resource (Customer
// Master v2): accountInfo, billing, branches, addresses, contacts. Branches
// bundles its Address/Contact sub-tabs in one nested write today, so all
// three groups must be EDIT for the write to proceed — see
// write-organization-children.ts.
export async function getOrganizationSectionPermissions(role: Role): Promise<OrganizationSectionPermissions> {
  const map = await getFieldAccessMap(role, "organization");
  return {
    canEditBranches: map.branches === "EDIT" && map.addresses === "EDIT" && map.contacts === "EDIT",
    canEditBilling: map.billing === "EDIT",
    canEditAccountInfo: map.accountInfo === "EDIT",
  };
}
