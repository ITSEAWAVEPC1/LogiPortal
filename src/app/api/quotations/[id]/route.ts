import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const DETAIL_INCLUDE = {
  organization: { select: { id: true, name: true, defaultCurrency: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  customerApprovedBy: { select: { id: true, name: true } },
  enquiries: {
    include: {
      enquiry: {
        include: {
          freightDetail: true,
          customsDetail: true,
          transportDetail: true,
        },
      },
    },
  },
  versions: {
    orderBy: { versionNumber: "desc" as const },
    include: { createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
  },
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Full line items only for the current version, to keep the version-history
  // panel light — older versions surface metadata only (who/when/total).
  const currentVersion = quotation.versions.find((v) => v.versionNumber === quotation.currentVersionNumber);
  const lineItems = currentVersion
    ? await prisma.quotationLineItem.findMany({
        where: { quotationVersionId: currentVersion.id },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  return NextResponse.json({ quotation, currentVersion, lineItems });
}
