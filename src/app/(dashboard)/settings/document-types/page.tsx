import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { DocumentTypeManager } from "./_components/DocumentTypeManager";

export default async function DocumentTypesSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "documentTypes", "create")) redirect("/settings");

  const documentTypes = await prisma.documentType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return <DocumentTypeManager documentTypes={documentTypes} />;
}
