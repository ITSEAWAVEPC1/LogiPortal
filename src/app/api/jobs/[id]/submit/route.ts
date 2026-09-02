import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { jobSubmitSchema } from "@/lib/validation/job";

// DRAFT | NEEDS_CORRECTION -> PENDING_REVIEW. Always re-validates from the DB's
// current state, never the request body (same precedent as enquiry/quotation
// submit and Stage 1's bulk-import commit).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "jobs", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { shipperDetail: true, consigneeDetail: true, notifyPartyDetail: true, containers: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (job.status !== "DRAFT" && job.status !== "NEEDS_CORRECTION") {
    return NextResponse.json({ error: `Cannot submit a job with status ${job.status}` }, { status: 409 });
  }

  const parsed = jobSubmitSchema.safeParse({
    shipmentType: job.shipmentType,
    serviceTypes: job.serviceTypes,
    incoterm: job.incoterm,
    exportStuffingType: job.exportStuffingType,
    agentDetails: job.agentDetails,
    placeOfReceipt: job.placeOfReceipt,
    portOfLoading: job.portOfLoading,
    portOfDischarge: job.portOfDischarge,
    placeOfDelivery: job.placeOfDelivery,
    shippingLineName: job.shippingLineName,
    cfsName: job.cfsName,
    vesselName: job.vesselName,
    voyageNumber: job.voyageNumber,
    freeDaysAtPod: job.freeDaysAtPod,
    totalGrossWeight: job.totalGrossWeight,
    totalNetWeight: job.totalNetWeight,
    totalPackages: job.totalPackages,
    volumeCbm: job.volumeCbm,
    commodity: job.commodity,
    hsCode: job.hsCode,
    containers: job.containers,
    shipperDetail: job.shipperDetail ?? undefined,
    consigneeDetail: job.consigneeDetail ?? undefined,
    notifyPartyDetail: job.notifyPartyDetail ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.job.update({ where: { id }, data: { status: "PENDING_REVIEW" } });
  return NextResponse.json({ job: updated });
}
