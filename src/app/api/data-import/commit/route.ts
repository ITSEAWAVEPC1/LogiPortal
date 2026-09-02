import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { isImportEntity } from "@/lib/import/entity-config";
import { validateCustomerRows } from "@/lib/import/validate-customer-rows";
import { validateJobRows } from "@/lib/import/validate-job-rows";
import { normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";
import { parseImportNumber } from "@/lib/validation/job";
import { allocateRfqReferenceBlock } from "@/lib/reference/generate-reference";
import { Prisma } from "@/generated/prisma/client";

interface CommitCounts {
  validRows: number;
  invalidRows: number;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const importBatchId = body.importBatchId as string | undefined;
  const rows = body.rows as Record<string, string>[] | undefined;
  const mapping = body.mapping as Record<string, string | null> | undefined;
  const entityType = isImportEntity(body.entityType) ? body.entityType : "CUSTOMER";
  if (!importBatchId || !Array.isArray(rows) || !mapping) {
    return NextResponse.json({ error: "Missing importBatchId, rows, or mapping" }, { status: 400 });
  }

  const batch = await prisma.importBatch.findUnique({ where: { id: importBatchId } });
  if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
  if (batch.status === "COMPLETED") {
    return NextResponse.json({ error: "This batch has already been imported" }, { status: 409 });
  }

  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: { status: "PROCESSING", startedAt: new Date(), columnMapping: mapping },
  });

  try {
    const counts =
      entityType === "JOB"
        ? await commitJobRows(importBatchId, rows, mapping, session.user.id)
        : await commitCustomerRows(importBatchId, rows, mapping, session.user.id);

    const updated = await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: "COMPLETED",
        validRows: counts.validRows,
        invalidRows: counts.invalidRows,
        importedRows: counts.validRows,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ importBatch: updated });
  } catch (error) {
    const failed = await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: "FAILED",
        failureReason: error instanceof Error ? error.message : "Unknown error during import",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: "Import failed", importBatch: failed }, { status: 500 });
  }
}

// --- Customer commit (Stage 1, unchanged behaviour) ---------------------------
//
// IDs generated client-side (not Prisma's @default(cuid())) so parent + child
// rows link without nested writes and insert via createMany — a handful of
// round trips total, not one per row. A single array-form $transaction: either
// everything commits or (on any failure) nothing does and the batch is FAILED.
async function commitCustomerRows(
  importBatchId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  userId: string,
): Promise<CommitCounts> {
  const { rows: validated } = await validateCustomerRows(rows, mapping);
  const validRows = validated.filter((r) => r.valid);
  const invalidRows = validated.filter((r) => !r.valid);

  const orgIds = validRows.map(() => randomUUID());
  const organizationsData = validRows.map((row, i) => ({
    id: orgIds[i],
    name: row.mapped.name,
    contactPersonName: row.mapped.contactPersonName || null,
    contactPersonPhone: row.mapped.contactPersonPhone || null,
    contactPersonEmail: row.mapped.contactPersonEmail || null,
    city: row.mapped.city || null,
    state: row.mapped.state || null,
    createdById: userId,
    importBatchId,
  }));
  const kycDetailsData = validRows.map((row, i) => ({
    id: randomUUID(),
    organizationId: orgIds[i],
    gstNumber: row.mapped.gstNumber ? normalizeGst(row.mapped.gstNumber) : null,
    panNumber: row.mapped.panNumber ? normalizePan(row.mapped.panNumber) : null,
    tanNumber: row.mapped.tanNumber ? normalizeTan(row.mapped.tanNumber) : null,
  }));

  await prisma.$transaction([
    ...(organizationsData.length > 0 ? [prisma.organization.createMany({ data: organizationsData })] : []),
    ...(kycDetailsData.length > 0 ? [prisma.kycDetail.createMany({ data: kycDetailsData })] : []),
    ...rowErrorInserts(importBatchId, invalidRows),
  ]);

  return { validRows: validRows.length, invalidRows: invalidRows.length };
}

// --- Job commit (Stage 4) ---------------------------------------------------
//
// Same client-ID + array-form $transaction pattern, fanned out across Job +
// its optional detail tables. Historical Jobs land at their mapped JobStatus
// with origin IMPORTED — no Branch Manager review.
async function commitJobRows(
  importBatchId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  userId: string,
): Promise<CommitCounts> {
  const { rows: validated, resolved } = await validateJobRows(rows, mapping);
  const validRows = validated.filter((r) => r.valid);
  const invalidRows = validated.filter((r) => !r.valid);

  const jobIds = validRows.map(() => randomUUID());
  // Imported jobs have no parent enquiry — reserve a contiguous block of fresh
  // RFQ references in one round trip (no per-row counter work).
  const refs = await prisma.$transaction((tx) => allocateRfqReferenceBlock(tx, validRows.length));
  const toInt = (v: string) => {
    const n = parseImportNumber(v);
    return n === null ? null : Math.round(n);
  };

  const jobsData = validRows.map((row, i) => {
    const r = resolved[row.rowNumber];
    const m = row.mapped;
    return {
      id: jobIds[i],
      origin: "IMPORTED" as const,
      status: r.status,
      branchId: r.branchId,
      organizationId: r.organizationId,
      shipmentType: r.shipmentType,
      referenceNo: refs[i].referenceNo,
      refYear: refs[i].refYear,
      refSequence: refs[i].refSequence,
      sourceReference: null,
      serviceTypes: r.serviceTypes as unknown as Prisma.JobCreateManyInput["serviceTypes"],
      incoterm: m.incoterm || null,
      agentDetails: m.agentDetails || null,
      placeOfReceipt: m.placeOfReceipt || null,
      portOfLoading: m.portOfLoading || null,
      portOfDischarge: m.portOfDischarge || null,
      placeOfDelivery: m.placeOfDelivery || null,
      shippingLineName: m.shippingLineName || null,
      cfsName: m.cfsName || null,
      vesselName: m.vesselName || null,
      voyageNumber: m.voyageNumber || null,
      freeDaysAtPod: toInt(m.freeDaysAtPod),
      totalGrossWeight: parseImportNumber(m.totalGrossWeight),
      totalNetWeight: parseImportNumber(m.totalNetWeight),
      totalPackages: toInt(m.totalPackages),
      volumeCbm: parseImportNumber(m.volumeCbm),
      commodity: m.commodity || null,
      hsCode: m.hsCode || null,
      createdById: userId,
      importBatchId,
    };
  });

  const shipperData: Prisma.ShipperDetailCreateManyInput[] = [];
  const consigneeData: Prisma.ConsigneeDetailCreateManyInput[] = [];
  const notifyData: Prisma.NotifyPartyDetailCreateManyInput[] = [];
  const containerData: Prisma.ContainerDetailCreateManyInput[] = [];
  validRows.forEach((row, i) => {
    const m = row.mapped;
    if (m.shipperName || m.shipperAddress) {
      shipperData.push({ id: randomUUID(), jobId: jobIds[i], name: m.shipperName || null, address: m.shipperAddress || null });
    }
    if (m.consigneeName || m.consigneeAddress) {
      consigneeData.push({ id: randomUUID(), jobId: jobIds[i], name: m.consigneeName || null, address: m.consigneeAddress || null });
    }
    if (m.notifyName) {
      notifyData.push({ id: randomUUID(), jobId: jobIds[i], name: m.notifyName });
    }
    if (m.containerType || m.containerCount) {
      containerData.push({
        id: randomUUID(),
        jobId: jobIds[i],
        containerType: m.containerType || null,
        count: toInt(m.containerCount) ?? 1,
        sortOrder: 0,
      });
    }
  });

  await prisma.$transaction([
    ...(jobsData.length > 0 ? [prisma.job.createMany({ data: jobsData })] : []),
    ...(shipperData.length > 0 ? [prisma.shipperDetail.createMany({ data: shipperData })] : []),
    ...(consigneeData.length > 0 ? [prisma.consigneeDetail.createMany({ data: consigneeData })] : []),
    ...(notifyData.length > 0 ? [prisma.notifyPartyDetail.createMany({ data: notifyData })] : []),
    ...(containerData.length > 0 ? [prisma.containerDetail.createMany({ data: containerData })] : []),
    ...rowErrorInserts(importBatchId, invalidRows),
  ]);

  return { validRows: validRows.length, invalidRows: invalidRows.length };
}

function rowErrorInserts(
  importBatchId: string,
  invalidRows: { rowNumber: number; raw: Record<string, string>; errors: unknown }[],
) {
  if (invalidRows.length === 0) return [];
  return [
    prisma.importRowError.createMany({
      data: invalidRows.map((row) => ({
        importBatchId,
        rowNumber: row.rowNumber,
        rawData: row.raw,
        errors: row.errors as unknown as Prisma.InputJsonValue,
      })),
    }),
  ];
}
