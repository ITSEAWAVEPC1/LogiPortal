import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui";
import { can } from "@/lib/permissions/capabilities";
import type { Prisma } from "@/generated/prisma/client";
import { JobList } from "./_components/JobList";

interface JobsPageProps {
  searchParams: Promise<{ status?: string; branchId?: string; shipmentType?: string; q?: string; page?: string }>;
}

const STATUS_VALUES = [
  "DRAFT",
  "PENDING_REVIEW",
  "NEEDS_CORRECTION",
  "WORKFLOW_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
const SHIPMENT_TYPES = ["IMPORT", "EXPORT"] as const;
const PAGE_SIZE = 25;

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;

  if (!can(role, "jobs", "view")) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Jobs</h1>
        <Card>
          <p className="text-sm text-text-secondary">You don&apos;t have access to Jobs.</p>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const status = STATUS_VALUES.find((s) => s === params.status) ?? "WORKFLOW_IN_PROGRESS";
  const shipmentType = SHIPMENT_TYPES.find((s) => s === params.shipmentType);
  const branchId = params.branchId;
  const q = params.q?.trim();
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.JobWhereInput = {
    status,
    shipmentType,
    branchId: branchId || undefined,
    ...(q
      ? {
          OR: [
            { organization: { name: { contains: q, mode: "insensitive" } } },
            { vesselName: { contains: q, mode: "insensitive" } },
            { portOfLoading: { contains: q, mode: "insensitive" } },
            { portOfDischarge: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [jobs, total, branches] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.job.count({ where }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <JobList
      jobs={jobs}
      branches={branches}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      initialQuery={{
        status,
        branchId: branchId ?? "",
        shipmentType: shipmentType ?? "",
        q: q ?? "",
      }}
      canCreate={can(role, "jobs", "create")}
      canApprove={can(role, "jobs", "approve")}
      canImport={can(role, "dataImport", "create")}
    />
  );
}
