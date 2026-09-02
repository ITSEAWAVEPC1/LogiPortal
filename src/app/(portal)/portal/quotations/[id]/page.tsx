import Link from "next/link";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalQuotation } from "@/lib/portal/queries";
import { PortalQuotationView } from "./_components/PortalQuotationView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalQuotationDetailPage({ params }: PageProps) {
  const ctx = await getPortalContext();
  const { id } = await params;

  // getPortalQuotation() logs + notFound()s any quotation outside this org.
  const quotation = await getPortalQuotation(id, ctx, `/portal/quotations/${id}`);

  return (
    <div>
      <Link href="/portal/quotations" className="mb-4 inline-block text-sm text-brand-teal underline">
        ← Back to quotations
      </Link>
      <PortalQuotationView quotation={quotation} />
    </div>
  );
}
