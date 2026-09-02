import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalQuotations } from "@/lib/portal/queries";
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
        {result.quotations.length === 0 ? (
          <p className="text-sm text-text-secondary">No quotations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-tertiary">
                  <th className="py-2 pr-4 font-medium">Reference</th>
                  <th className="py-2 pr-4 font-medium">Shipments</th>
                  <th className="py-2 pr-4 font-medium">Version</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Updated</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.quotations.map((qt) => (
                  <tr key={qt.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/portal/quotations/${qt.id}`} className="font-medium text-brand-teal underline">
                        {qt.ref}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{qt.shipments}</td>
                    <td className="py-2 pr-4">v{qt.versionNumber}</td>
                    <td className="py-2 pr-4">{money(qt.total, qt.currency)}</td>
                    <td className="py-2 pr-4 text-text-tertiary">{shortDate(qt.updatedAt)}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={quotationStatusVariant(qt.status)}>{statusLabel(qt.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
