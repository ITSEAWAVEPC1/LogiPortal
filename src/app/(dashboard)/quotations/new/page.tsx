import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { NewQuotationForm } from "../_components/NewQuotationForm";

export default async function NewQuotationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "quotations", "create")) redirect("/quotations");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">New Quotation</h1>
      <NewQuotationForm branches={branches} />
    </div>
  );
}
