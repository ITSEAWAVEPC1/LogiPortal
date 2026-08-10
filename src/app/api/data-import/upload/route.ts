import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { parseWorkbook } from "@/lib/import/parse-workbook";
import { suggestColumnMapping } from "@/lib/import/column-matcher";

// Generous for a few-hundred-row sheet; caps worst-case parse cost per request.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseWorkbook(buffer, file.name);
  } catch {
    return NextResponse.json({ error: "Could not parse the uploaded file. Use .xlsx or .csv." }, { status: 400 });
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "The uploaded file has no data rows." }, { status: 400 });
  }

  // Logged immediately, even if the wizard is abandoned after this step —
  // Section 6 point 6's traceability requirement.
  const importBatch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      uploadedById: session.user.id,
      totalRows: parsed.rows.length,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    importBatchId: importBatch.id,
    headers: parsed.headers,
    rows: parsed.rows,
    suggestedMapping: suggestColumnMapping(parsed.headers),
    totalRows: parsed.rows.length,
  });
}
