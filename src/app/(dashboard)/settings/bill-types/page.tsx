import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { BillTypeManager } from "./_components/BillTypeManager";

export default async function BillTypesSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "billTypes", "create")) redirect("/settings");

  const billTypes = await prisma.billType.findMany({ orderBy: { name: "asc" } });

  return <BillTypeManager billTypes={billTypes} />;
}
