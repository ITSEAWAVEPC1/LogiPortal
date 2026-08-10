import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { validateCustomerRows } from "@/lib/import/validate-customer-rows";
import { normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";
import { Prisma } from "@/generated/prisma/client";

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

  // Always re-validate server-side — never trust client-computed validity.
  const { rows: validated } = await validateCustomerRows(rows, mapping);
  const validRows = validated.filter((r) => r.valid);
  const invalidRows = validated.filter((r) => !r.valid);

  // IDs generated client-side (not left to Prisma's @default(cuid())) so
  // Organization and KycDetail rows can be inserted via createMany — a
  // handful of round trips total, not one round trip per row. A sequential
  // .create() per row (170+ round trips to Neon) was the first approach here
  // and reliably blew even a 30s transaction timeout purely on network RTT;
  // batching is a correctness requirement at this row count, not an
  // optimization.
  const orgIds = validRows.map(() => randomUUID());
  const organizationsData = validRows.map((row, i) => ({
    id: orgIds[i],
    name: row.mapped.name,
    contactPersonName: row.mapped.contactPersonName || null,
    contactPersonPhone: row.mapped.contactPersonPhone || null,
    contactPersonEmail: row.mapped.contactPersonEmail || null,
    city: row.mapped.city || null,
    state: row.mapped.state || null,
    createdById: session.user.id,
    importBatchId,
  }));
  const kycDetailsData = validRows.map((row, i) => ({
    id: randomUUID(),
    organizationId: orgIds[i],
    gstNumber: row.mapped.gstNumber ? normalizeGst(row.mapped.gstNumber) : null,
    panNumber: row.mapped.panNumber ? normalizePan(row.mapped.panNumber) : null,
    tanNumber: row.mapped.tanNumber ? normalizeTan(row.mapped.tanNumber) : null,
  }));

  // Single array-form transaction: atomic. Either everything commits (valid
  // rows inserted, invalid rows logged) or (on any failure) NONE of it does
  // and the batch is marked FAILED — matching the failover spec's "a failed
  // batch rolls back entirely, not leave partial data" literally.
  try {
    await prisma.$transaction([
      ...(organizationsData.length > 0 ? [prisma.organization.createMany({ data: organizationsData })] : []),
      ...(kycDetailsData.length > 0 ? [prisma.kycDetail.createMany({ data: kycDetailsData })] : []),
      ...(invalidRows.length > 0
        ? [
            prisma.importRowError.createMany({
              data: invalidRows.map((row) => ({
                importBatchId,
                rowNumber: row.rowNumber,
                rawData: row.raw,
                errors: row.errors as unknown as Prisma.InputJsonValue,
              })),
            }),
          ]
        : []),
    ]);

    const updated = await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        status: "COMPLETED",
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        importedRows: validRows.length,
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
