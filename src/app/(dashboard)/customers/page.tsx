import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui";
import { CustomerDirectory } from "./_components/CustomerDirectory";

interface CustomersPageProps {
  searchParams: Promise<{ q?: string; branchId?: string; status?: string }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;

  // "Own org only" needs User.organizationId, which Stage 9 (Customer Portal)
  // introduces — not before. See docs/stage-checklists/stage-1.md.
  if (role === "CUSTOMER") {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Customers</h1>
        <Card>
          <p className="text-sm text-text-secondary">
            Your organization&apos;s profile will be available here starting Stage 9 (Customer Portal).
          </p>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const q = params.q?.trim();
  const branchId = params.branchId;
  const status = params.status;

  const [organizations, branches] = await Promise.all([
    prisma.organization.findMany({
      where: {
        isActive: status === "inactive" ? false : status === "active" ? true : undefined,
        branchId: branchId || undefined,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { contactPersonName: { contains: q, mode: "insensitive" } },
                { kycDetail: { gstNumber: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { kycDetail: true, branch: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <CustomerDirectory
      organizations={organizations}
      branches={branches}
      role={role}
      initialQuery={{ q: q ?? "", branchId: branchId ?? "", status: status ?? "" }}
    />
  );
}
