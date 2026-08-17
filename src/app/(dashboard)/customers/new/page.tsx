import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getFieldAccessMap } from "@/lib/permissions/field-permissions";
import { OrganizationEditor } from "../_components/OrganizationEditor";
import { emptyOrganizationForm } from "../_components/types";

export default async function NewCustomerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "customers", "create")) redirect("/customers");

  const [homeBranches, staff, billTypes, organizations, fieldAccessMap] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.billType.findMany({ orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getFieldAccessMap(session.user.role, "organization"),
  ]);

  return (
    <OrganizationEditor
      mode="create"
      initialForm={emptyOrganizationForm()}
      homeBranches={homeBranches}
      staff={staff}
      billTypeOptions={billTypes}
      organizationOptions={organizations}
      fieldAccess={{
        accountInfo: fieldAccessMap.accountInfo ?? "NONE",
        billing: fieldAccessMap.billing ?? "NONE",
        branches: fieldAccessMap.branches ?? "NONE",
        addresses: fieldAccessMap.addresses ?? "NONE",
        contacts: fieldAccessMap.contacts ?? "NONE",
      }}
      canEditGeneral={can(session.user.role, "customers", "create")}
    />
  );
}
