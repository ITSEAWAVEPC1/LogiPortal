import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { QuotationDetail } from "../_components/QuotationDetail";

interface QuotationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuotationDetailPage({ params }: QuotationDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "quotations", "view")) redirect("/quotations");

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      customerApprovedBy: { select: { id: true, name: true } },
      enquiries: {
        include: {
          enquiry: {
            select: {
              id: true,
              sequenceNumber: true,
              referenceNo: true,
              createdAt: true,
              shipmentType: true,
              serviceTypes: true,
            },
          },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!quotation) notFound();

  const currentVersion = quotation.versions.find((v) => v.versionNumber === quotation.currentVersionNumber);
  const lineItems = currentVersion
    ? await prisma.quotationLineItem.findMany({
        where: { quotationVersionId: currentVersion.id },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  if (!currentVersion) notFound();

  const canEdit = can(session.user.role, "quotations", "edit");

  return (
    <QuotationDetail
      // Forces a full remount if a line-item edit on an approved quotation
      // clones a new version server-side — local editor state should never
      // straddle two different QuotationVersion records.
      key={`${quotation.id}-${quotation.currentVersionNumber}`}
      quotation={quotation}
      lineItems={lineItems}
      canEdit={canEdit}
    />
  );
}
