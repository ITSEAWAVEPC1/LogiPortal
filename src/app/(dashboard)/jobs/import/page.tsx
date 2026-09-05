import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ImportWizard } from "@/app/(dashboard)/data-import/_components/ImportWizard";
import { BatchHistoryTable } from "@/app/(dashboard)/data-import/_components/BatchHistoryTable";

// Admin-only historical/open Job migration — reuses the Stage 1 wizard with
// entityType="JOB" (parameterised, not duplicated).
export default async function JobImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "dataImport", "create")) redirect("/jobs");

  const batches = await prisma.importBatch.findMany({
    where: { entityType: "JOB" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Import Historical Jobs</h1>
        <Link href="/jobs" className="text-sm font-medium text-brand-teal hover:underline">
          &larr; Back to Jobs
        </Link>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        Each row must resolve to an existing customer and branch and carry a recognisable workflow status. Imported jobs
        skip the review gate and land at their mapped status.
      </p>
      <ImportWizard entityType="JOB" />
      <BatchHistoryTable batches={batches} />
    </div>
  );
}
