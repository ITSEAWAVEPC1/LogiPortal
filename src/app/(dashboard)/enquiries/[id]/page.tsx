import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getEnquiryFieldConfigMap } from "@/lib/enquiries/field-config";
import { EnquiryForm } from "../_components/EnquiryForm";

interface EnquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EnquiryDetailPage({ params }: EnquiryDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "enquiries", "view")) redirect("/enquiries");

  const { id } = await params;
  const [enquiry, branches, ports, fieldConfig] = await Promise.all([
    prisma.enquiry.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        doer: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        freightDetail: { include: { packages: { orderBy: { sortOrder: "asc" } } } },
        customsDetail: { include: { commodityLines: { orderBy: { sortOrder: "asc" } } } },
        transportDetail: true,
        quotationEnquiry: { select: { id: true } },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.port.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    getEnquiryFieldConfigMap(),
  ]);

  if (!enquiry) notFound();

  const canEdit = can(session.user.role, "enquiries", "edit");

  return (
    <EnquiryForm
      enquiry={enquiry}
      branches={branches}
      ports={ports}
      fieldConfig={fieldConfig}
      canEdit={canEdit}
      isLocked={enquiry.quotationEnquiry !== null}
    />
  );
}
