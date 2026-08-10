import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

// Poll target for the wizard's Summary step; also future-proofs an async
// worker (Vercel Cron/Upstash, added in a later stage) updating status
// out-of-request-cycle without any API contract change.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "dataImport", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const importBatch = await prisma.importBatch.findUnique({
    where: { id },
    include: { uploadedBy: { select: { name: true } } },
  });
  if (!importBatch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ importBatch });
}
