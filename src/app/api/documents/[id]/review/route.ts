import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { documentReviewSchema } from "@/lib/validation/document";
import { DOCUMENT_DETAIL_SELECT, serializeDocument } from "@/lib/documents/document-service";

// §4.3 Documents row: Branch Manager approves. approve -> APPROVED (+ stamp);
// reject -> REJECTED (+ note, clears any share/approval stamp).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "documents", "approve")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = documentReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { action, note } = parsed.data;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, isActive: true },
  });
  if (!doc || !doc.isActive) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "DRAFT" && doc.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: `Cannot review a document that is ${doc.status}` }, { status: 409 });
  }

  await prisma.document.update({
    where: { id },
    data:
      action === "approve"
        ? { status: "APPROVED", approvedById: actorId, approvedAt: new Date(), reviewNote: null }
        : {
            status: "REJECTED",
            reviewNote: note,
            approvedById: null,
            approvedAt: null,
            sharedWithCustomer: false,
          },
  });

  const full = await prisma.document.findUnique({ where: { id }, select: DOCUMENT_DETAIL_SELECT });
  return NextResponse.json({ document: serializeDocument(full!) });
}
