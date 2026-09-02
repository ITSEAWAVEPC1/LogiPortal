import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { canReadDocument } from "@/lib/permissions/document-access";
import { resolveViewerOrgId } from "@/lib/documents/document-service";

// Streams a document version's bytes (Content-Disposition: inline). A GENERATED
// version whose render failed all attempts has no bytes — this returns
// { fallback: true, data } (200) so the client renders DocumentHtmlPreview from
// the retained sourceSnapshot, exactly like the Stage 3 Quotation PDF failover.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: userId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, versionId } = await params;
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      documentId: true,
      fileName: true,
      contentType: true,
      bytes: true,
      generationStatus: true,
      sourceSnapshot: true,
      document: {
        select: {
          id: true,
          isActive: true,
          isFinancial: true,
          status: true,
          sharedWithCustomer: true,
          job: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!version || version.documentId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = await resolveViewerOrgId(role, userId);
  if (!canReadDocument(role, orgId, version.document)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!version.bytes || version.generationStatus === "FAILED") {
    return NextResponse.json({ fallback: true, data: version.sourceSnapshot ?? null }, { status: 200 });
  }

  return new NextResponse(new Uint8Array(version.bytes), {
    headers: {
      "Content-Type": version.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${version.fileName.replace(/"/g, "")}"`,
    },
  });
}
