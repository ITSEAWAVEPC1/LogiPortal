import Link from "next/link";
import { Badge, Card, DataTable } from "@/components/ui";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalJobs, type PortalJobListRow } from "@/lib/portal/queries";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { jobStatusVariant, shortDate, statusLabel } from "@/components/portal/portal-format";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "WORKFLOW_IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

export default async function PortalJobsPage({ searchParams }: PageProps) {
  const ctx = await getPortalContext();
  const sp = await searchParams;
  const result = await getPortalJobs(ctx.orgId, {
    status: sp.status,
    q: sp.q,
    page: Number(sp.page) || 1,
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Shipments</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => {
          const active = (result.status || "") === t.value;
          const params = new URLSearchParams();
          if (t.value) params.set("status", t.value);
          if (result.q) params.set("q", result.q);
          return (
            <Link
              key={t.label}
              href={params.toString() ? `/portal/jobs?${params}` : "/portal/jobs"}
              className={`rounded-full border px-3 py-1 text-sm ${
                active ? "border-brand-teal bg-brand-teal/10 text-brand-teal" : "border-border-subtle text-text-secondary hover:bg-surface"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <form action="/portal/jobs" className="ml-auto flex gap-2">
          {result.status && <input type="hidden" name="status" value={result.status} />}
          <input
            name="q"
            defaultValue={result.q}
            placeholder="Search ref, vessel, port…"
            className="rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-surface">
            Search
          </button>
        </form>
      </div>

      <Card>
        <DataTable<PortalJobListRow>
          columns={[
            {
              key: "ref",
              header: "Reference",
              render: (j) => (
                <Link href={`/portal/jobs/${j.id}`} className="font-medium text-brand-teal underline">
                  {j.ref}
                </Link>
              ),
            },
            { key: "shipmentType", header: "Type" },
            { key: "route", header: "Route" },
            { key: "vessel", header: "Vessel" },
            { key: "updatedAt", header: "Updated", render: (j) => shortDate(j.updatedAt) },
            {
              key: "status",
              header: "Status",
              render: (j) => <Badge variant={jobStatusVariant(j.status)}>{statusLabel(j.status)}</Badge>,
            },
          ]}
          data={result.jobs}
          getRowKey={(j) => j.id}
          emptyMessage="No shipments match."
        />
        <PortalPagination
          basePath="/portal/jobs"
          query={{ status: result.status, q: result.q }}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
        />
      </Card>
    </div>
  );
}
