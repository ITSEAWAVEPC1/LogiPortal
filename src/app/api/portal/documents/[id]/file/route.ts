import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getPortalApiContext, logPortalAccess } from "@/lib/portal/guard";
import { readVersionFile } from "@/lib/pdf/document-storage";

// Stage 9 — isolated, read-only customer download. Streams the CURRENT version
// of a document only when it is APPROVED + sharedWithCustomer and its job
// belongs to the caller's organization. Any other case is logged (plan §8) and
// 403s. The internal /api/documents/* routes are never touched by the portal.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await getPortalApiContext();
  if (!guard.ok) return guard.response;
  const { userId, orgId } = guard;

  const { id } = await params;
  const path = `/api/portal/documents/${id}/file`;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
      status: true,
      sharedWithCustomer: true,
      currentVersionNumber: true,
      job: { select: { organizationId: true } },
      versions: {
        select: { id: true, versionNumber: true, generationStatus: true, sourceSnapshot: true },
      },
    },
  });

  const allowed =
    !!doc &&
    doc.isActive &&
    doc.status === "APPROVED" &&
    doc.sharedWithCustomer &&
    doc.job.organizationId === orgId;

  if (!allowed) {
    await logPortalAccess({
      userId,
      viewerOrgId: orgId,
      path,
      resourceType: "document",
      resourceId: id,
      outcome: !doc ? "DENIED_NOT_FOUND" : orgId === null ? "DENIED_UNLINKED" : "DENIED_CROSS_ORG",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber) ?? null;
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await readVersionFile(current.id);
  if (!file || current.generationStatus === "FAILED") {
    // Same failover contract as the internal file route.
    return NextResponse.json({ fallback: true, data: current.sourceSnapshot ?? null }, { status: 200 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
    },
  });
}
