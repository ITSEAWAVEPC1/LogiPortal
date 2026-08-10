import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { EnquiryForm } from "../_components/EnquiryForm";

interface EnquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EnquiryDetailPage({ params }: EnquiryDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "enquiries", "view")) redirect("/enquiries");

  const { id } = await params;
  const [enquiry, branches] = await Promise.all([
    prisma.enquiry.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        doer: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        freightDetail: true,
        customsDetail: true,
        transportDetail: true,
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!enquiry) notFound();

  const canEdit = can(session.user.role, "enquiries", "edit");
  const canApprove = can(session.user.role, "enquiries", "approve");

  return (
    <EnquiryForm enquiry={enquiry} branches={branches} role={session.user.role} canEdit={canEdit} canApprove={canApprove} />
  );
}
