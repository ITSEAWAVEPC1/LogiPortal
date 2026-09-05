import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui";
import { can } from "@/lib/permissions/capabilities";
import { EnquiryList } from "./_components/EnquiryList";

interface EnquiriesPageProps {
  searchParams: Promise<{ status?: string; branchId?: string; q?: string }>;
}

const STATUS_VALUES = ["DRAFT", "OPEN", "READY_FOR_QUOTATION", "NEEDS_CORRECTION"] as const;

export default async function EnquiriesPage({ searchParams }: EnquiriesPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;

  if (!can(role, "enquiries", "view")) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-text-primary">Enquiries</h1>
        <Card>
          <p className="text-sm text-text-secondary">You don&apos;t have access to Enquiries.</p>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  // Stage 12b removed the approval gate — submissions now land straight on
  // READY_FOR_QUOTATION, so that's the default landing tab instead of OPEN
  // (which nothing new reaches any more, though older rows may still sit
  // there).
  const status = STATUS_VALUES.find((s) => s === params.status) ?? "READY_FOR_QUOTATION";
  const branchId = params.branchId;
  const q = params.q?.trim();

  const [enquiries, branches] = await Promise.all([
    prisma.enquiry.findMany({
      where: {
        status,
        branchId: branchId || undefined,
        ...(q
          ? {
              OR: [
                { organization: { name: { contains: q, mode: "insensitive" } } },
                { contactPersonName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        doer: { select: { id: true, name: true } },
        quotationEnquiry: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const canCreate = can(role, "enquiries", "create");
  const canEdit = can(role, "enquiries", "edit");

  return (
    <EnquiryList
      enquiries={enquiries}
      branches={branches}
      initialQuery={{ status, branchId: branchId ?? "", q: q ?? "" }}
      canCreate={canCreate}
      canEdit={canEdit}
    />
  );
}
