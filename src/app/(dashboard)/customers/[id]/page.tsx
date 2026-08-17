import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getFieldAccessMap } from "@/lib/permissions/field-permissions";
import { organizationDetailInclude } from "@/lib/organizations/organization-include";
import { OrganizationEditor } from "../_components/OrganizationEditor";
import { mapOrganizationToForm } from "../_components/map-organization";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "customers", "edit") && !can(session.user.role, "customers", "view")) {
    redirect("/customers");
  }

  const { id } = await params;

  const [organization, homeBranches, staff, billTypes, organizations, fieldAccessMap] = await Promise.all([
    prisma.organization.findUnique({ where: { id }, include: organizationDetailInclude }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.billType.findMany({ orderBy: { name: "asc" } }),
    prisma.organization.findMany({
      where: { isActive: true, id: { not: id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getFieldAccessMap(session.user.role, "organization"),
  ]);

  if (!organization) notFound();

  return (
    <OrganizationEditor
      mode="edit"
      organizationId={organization.id}
      initialForm={mapOrganizationToForm(organization)}
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
      canEditGeneral={can(session.user.role, "customers", "edit")}
    />
  );
}
