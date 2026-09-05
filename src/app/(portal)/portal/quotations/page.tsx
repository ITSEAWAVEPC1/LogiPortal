import Link from "next/link";
import { Badge, Card, DataTable } from "@/components/ui";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalQuotations, type PortalQuotationListRow } from "@/lib/portal/queries";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { money, quotationStatusVariant, shortDate, statusLabel } from "@/components/portal/portal-format";

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

export default async function PortalQuotationsPage({ searchParams }: PageProps) {
  const ctx = await getPortalContext();
  const sp = await searchParams;
  const result = await getPortalQuotations(ctx.orgId, { status: sp.status, q: sp.q, page: Number(sp.page) || 1 });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Quotations</h1>

      <form action="/portal/quotations" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={result.q}
          placeholder="Search reference…"
          className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface">
          Search
        </button>
      </form>

      <Card>
        <DataTable<PortalQuotationListRow>
          columns={[
            {
              key: "ref",
              header: "Reference",
              render: (qt) => (
                <Link href={`/portal/quotations/${qt.id}`} className="font-medium text-brand-teal underline">
                  {qt.ref}
                </Link>
              ),
            },
            { key: "shipments", header: "Shipments" },
            { key: "versionNumber", header: "Version", render: (qt) => `v${qt.versionNumber}` },
            { key: "total", header: "Total", render: (qt) => money(qt.total, qt.currency) },
            { key: "updatedAt", header: "Updated", render: (qt) => shortDate(qt.updatedAt) },
            {
              key: "status",
              header: "Status",
              render: (qt) => <Badge variant={quotationStatusVariant(qt.status)}>{statusLabel(qt.status)}</Badge>,
            },
          ]}
          data={result.quotations}
          getRowKey={(qt) => qt.id}
          emptyMessage="No quotations yet."
        />
        <PortalPagination
          basePath="/portal/quotations"
          query={{ q: result.q }}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
        />
      </Card>
    </div>
  );
}
