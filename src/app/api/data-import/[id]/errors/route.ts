import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { rowsToCsv } from "@/lib/import/csv-export";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const rowErrors = await prisma.importRowError.findMany({
    where: { importBatchId: id },
    orderBy: { rowNumber: "asc" },
  });

  const headers = ["Row", "Errors", "Raw Data"];
  const rows = rowErrors.map((r) => [
    String(r.rowNumber),
    (r.errors as { field: string; message: string }[]).map((e) => `${e.field}: ${e.message}`).join("; "),
    JSON.stringify(r.rawData),
  ]);

  const csv = rowsToCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="import-${id}-errors.csv"`,
    },
  });
}
