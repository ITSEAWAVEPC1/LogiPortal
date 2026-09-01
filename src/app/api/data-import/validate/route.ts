import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { can } from "@/lib/permissions/capabilities";
import { isImportEntity } from "@/lib/import/entity-config";
import { validateCustomerRows } from "@/lib/import/validate-customer-rows";
import { validateJobRows } from "@/lib/import/validate-job-rows";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const rows = body.rows as Record<string, string>[] | undefined;
  const mapping = body.mapping as Record<string, string | null> | undefined;
  const entityType = isImportEntity(body.entityType) ? body.entityType : "CUSTOMER";
  if (!Array.isArray(rows) || !mapping) {
    return NextResponse.json({ error: "Missing rows or mapping" }, { status: 400 });
  }

  if (entityType === "JOB") {
    const { rows: validated, validCount, invalidCount } = await validateJobRows(rows, mapping);
    return NextResponse.json({ rows: validated, validCount, invalidCount });
  }

  const result = await validateCustomerRows(rows, mapping);
  return NextResponse.json(result);
}
