import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { PortManager } from "./_components/PortManager";

export default async function PortsSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "ports", "create")) redirect("/settings");

  const ports = await prisma.port.findMany({ orderBy: { name: "asc" } });

  return <PortManager ports={ports} />;
}
