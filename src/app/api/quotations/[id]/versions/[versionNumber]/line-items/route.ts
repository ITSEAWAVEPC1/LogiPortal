import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

// Read-only — the Version History drill-down. Historical versions' line
// items are never edited (an edit after approval clones a NEW version
// rather than touching a past one — see stage-3.md), so this needs no
// PUT/PATCH counterpart.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; versionNumber: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "quotations", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, versionNumber: versionNumberParam } = await params;
  const versionNumber = Number(versionNumberParam);
  if (!Number.isInteger(versionNumber)) {
    return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
  }

  const version = await prisma.quotationVersion.findUnique({
    where: { quotationId_versionNumber: { quotationId: id, versionNumber } },
  });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lineItems = await prisma.quotationLineItem.findMany({
    where: { quotationVersionId: version.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ lineItems });
}
