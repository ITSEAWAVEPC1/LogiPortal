import Link from "next/link";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalJob, getPortalDocuments } from "@/lib/portal/queries";
import { PortalJobView } from "./_components/PortalJobView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalJobDetailPage({ params }: PageProps) {
  const ctx = await getPortalContext();
  const { id } = await params;

  // getPortalJob() logs + notFound()s any job that isn't this customer's org.
  const job = await getPortalJob(id, ctx, `/portal/jobs/${id}`);
  const documents = await getPortalDocuments(ctx.orgId, id);

  return (
    <div>
      <Link href="/portal/jobs" className="mb-4 inline-block text-sm text-brand-teal underline">
        ← Back to shipments
      </Link>
      <PortalJobView job={job} documents={documents} />
    </div>
  );
}
