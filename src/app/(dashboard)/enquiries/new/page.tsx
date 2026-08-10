import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { NewEnquiryForm } from "../_components/NewEnquiryForm";

export default async function NewEnquiryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "enquiries", "create")) redirect("/enquiries");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">New Enquiry</h1>
      <NewEnquiryForm branches={branches} />
    </div>
  );
}
