import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { buildDocumentListWhere } from "@/lib/permissions/document-access";
import {
  DOCUMENT_CARD_SELECT,
  resolveViewerOrgId,
  serializeDocument,
} from "@/lib/documents/document-service";
import { DocumentsBrowser } from "./_components/DocumentsBrowser";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role, id: userId } = session.user;
  if (!can(role, "documents", "view")) redirect("/dashboard");

  const orgId = await resolveViewerOrgId(role, userId);
  const rows = await prisma.document.findMany({
    where: buildDocumentListWhere(role, orgId),
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_CARD_SELECT,
    take: 300,
  });

  return <DocumentsBrowser documents={rows.map(serializeDocument)} viewerRole={role} />;
}
