import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui";
import { can } from "@/lib/permissions/capabilities";
import { QuotationList } from "./_components/QuotationList";

interface QuotationsPageProps {
  searchParams: Promise<{ status?: string; branchId?: string; q?: string }>;
}

const STATUS_VALUES = [
  // Stage 14b pipeline
  "FLOATED",
  "COST_WORKING",
  "QUOTATION_PREPARED",
  "APPROVED",
  "CONVERTED",
  // legacy (pre-14b)
  "DRAFT",
  "PENDING_APPROVAL",
  "NEEDS_CORRECTION",
  "SENT",
  "CUSTOMER_APPROVED",
] as const;

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;

  if (!can(role, "quotations", "view")) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Quotations</h1>
        <Card>
          <p className="text-sm text-text-secondary">You don&apos;t have access to Quotations.</p>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const status = STATUS_VALUES.find((s) => s === params.status) ?? "FLOATED";
  const branchId = params.branchId;
  const q = params.q?.trim();

  const [quotations, branches] = await Promise.all([
    prisma.quotation.findMany({
      where: {
        status,
        branchId: branchId || undefined,
        ...(q ? { organization: { name: { contains: q, mode: "insensitive" } } } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { enquiries: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { totalAmount: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const canCreate = can(role, "quotations", "create");
  const canApprove = can(role, "quotations", "approve");

  return (
    <QuotationList
      quotations={quotations}
      branches={branches}
      initialQuery={{ status, branchId: branchId ?? "", q: q ?? "" }}
      canCreate={canCreate}
      canApprove={canApprove}
    />
  );
}
