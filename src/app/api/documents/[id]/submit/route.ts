import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getDocumentAccess } from "@/lib/permissions/document-access";
import { DOCUMENT_DETAIL_SELECT, serializeDocument } from "@/lib/documents/document-service";

// Creator (or Admin) hands a DRAFT/REJECTED document to the Branch Manager for
// the §4.3 approval gate.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, createdById: true, isActive: true },
  });
  if (!doc || !doc.isActive) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = getDocumentAccess(role);
  const isAdmin = role === "ADMIN";
  if (!isAdmin && !(access.canEditMeta && doc.createdById === actorId)) {
    return NextResponse.json({ error: "Only the document's creator can submit it" }, { status: 403 });
  }
  if (doc.status !== "DRAFT" && doc.status !== "REJECTED") {
    return NextResponse.json({ error: `Cannot submit a document that is ${doc.status}` }, { status: 409 });
  }

  await prisma.document.update({ where: { id }, data: { status: "PENDING_APPROVAL", reviewNote: null } });
  const full = await prisma.document.findUnique({ where: { id }, select: DOCUMENT_DETAIL_SELECT });
  return NextResponse.json({ document: serializeDocument(full!) });
}
