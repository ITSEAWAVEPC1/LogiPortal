import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { getDocumentAccess } from "@/lib/permissions/document-access";
import { ACCEPTED_UPLOAD_TYPES, MAX_DOCUMENT_FILE_SIZE, documentVersionSchema } from "@/lib/validation/document";
import { addDocumentVersion, serializeDocument } from "@/lib/documents/document-service";

// Add a version: JSON { mode: "regenerate" } (GENERATED docs) or multipart
// (a fresh uploaded file). Prior versions + their bytes are left untouched;
// currentVersionNumber bumps and the doc resets to DRAFT for re-review.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.document.findUnique({
    where: { id },
    select: { id: true, createdById: true, isActive: true },
  });
  if (!existing || !existing.isActive) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = getDocumentAccess(role);
  const isAdmin = role === "ADMIN";
  if (!isAdmin && !(access.canEditMeta && existing.createdById === actorId)) {
    return NextResponse.json({ error: "Only the document's creator can add a version" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let result: Awaited<ReturnType<typeof addDocumentVersion>>;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const f = form.get("file");
    if (!(f instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (f.size > MAX_DOCUMENT_FILE_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    if (f.type && !ACCEPTED_UPLOAD_TYPES.includes(f.type)) {
      return NextResponse.json({ error: "Only PDF, PNG or JPG files are accepted" }, { status: 400 });
    }
    const buffer = Buffer.from(await f.arrayBuffer());
    result = await addDocumentVersion(id, actorId, {
      mode: "upload",
      buffer,
      fileName: f.name || "upload",
      contentType: f.type || "application/octet-stream",
    });
  } else {
    const parsed = documentVersionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    result = await addDocumentVersion(id, actorId, { mode: "regenerate" });
  }

  if ("error" in result) {
    if (result.error === "not-generatable") {
      return NextResponse.json({ error: "This document was uploaded — regenerate is not available" }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ document: serializeDocument(result.document) });
}
