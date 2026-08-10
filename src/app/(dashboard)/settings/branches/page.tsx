import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { BranchManager } from "./_components/BranchManager";

export default async function BranchesSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "branches", "create")) redirect("/settings");

  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, organizations: true } } },
  });

  return <BranchManager branches={branches} />;
}
