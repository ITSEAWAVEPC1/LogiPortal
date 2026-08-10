import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ImportWizard } from "./_components/ImportWizard";
import { BatchHistoryTable } from "./_components/BatchHistoryTable";

export default async function DataImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "dataImport", "create")) redirect("/dashboard");

  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Data Import</h1>
      <ImportWizard />
      <BatchHistoryTable batches={batches} />
    </div>
  );
}
