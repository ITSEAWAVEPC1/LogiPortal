import { getPortalContext } from "@/lib/portal/guard";
import { getPortalDocuments } from "@/lib/portal/queries";
import { PortalDocumentsBrowser } from "@/components/portal/PortalDocumentsBrowser";

export default async function PortalDocumentsPage() {
  const ctx = await getPortalContext();
  const documents = await getPortalDocuments(ctx.orgId);

  return <PortalDocumentsBrowser documents={documents} />;
}
