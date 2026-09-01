import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { NewJobForm } from "../_components/NewJobForm";

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "jobs", "create")) redirect("/jobs");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">New Job</h1>
      <NewJobForm branches={branches} />
    </div>
  );
}
