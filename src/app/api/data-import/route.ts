import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { isImportEntity } from "@/lib/import/entity-config";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entityTypeParam = new URL(request.url).searchParams.get("entityType");
  const entityType = isImportEntity(entityTypeParam) ? entityTypeParam : undefined;

  const batches = await prisma.importBatch.findMany({
    where: { entityType },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { uploadedBy: { select: { name: true } } },
  });

  return NextResponse.json({ batches });
}
