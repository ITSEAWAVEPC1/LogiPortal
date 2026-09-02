import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { canReadDocument, getDocumentAccess } from "@/lib/permissions/document-access";
import { documentPatchSchema } from "@/lib/validation/document";
import {
  DOCUMENT_DETAIL_SELECT,
  resolveViewerOrgId,
  serializeDocument,
} from "@/lib/documents/document-service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: userId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: DOCUMENT_DETAIL_SELECT });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = await resolveViewerOrgId(role, userId);
  if (!canReadDocument(role, orgId, doc)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ document: serializeDocument(doc), viewerRole: role });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = documentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const patch = parsed.data;

  const existing = await prisma.document.findUnique({
    where: { id },
    select: { id: true, status: true, createdById: true, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = getDocumentAccess(role);
  const isAdmin = role === "ADMIN";
  const data: Record<string, unknown> = {};

  if (patch.isActive === false) {
    if (!access.canDeactivate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    data.isActive = false;
  }

  if (typeof patch.sharedWithCustomer === "boolean") {
    if (!access.canShareToggle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (patch.sharedWithCustomer && existing.status !== "APPROVED") {
      return NextResponse.json({ error: "Only an approved document can be shared with the customer" }, { status: 409 });
    }
    data.sharedWithCustomer = patch.sharedWithCustomer;
  }

  if (patch.title) {
    const canEditTitle = isAdmin || (access.canEditMeta && existing.createdById === actorId);
    if (!canEditTitle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    data.title = patch.title;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.document.update({ where: { id }, data });
  const full = await prisma.document.findUnique({ where: { id }, select: DOCUMENT_DETAIL_SELECT });
  return NextResponse.json({ document: serializeDocument(full!) });
}
