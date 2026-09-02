import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { getPortalContext } from "@/lib/portal/guard";
import { getPortalDashboard } from "@/lib/portal/queries";
import { jobStatusVariant, shortDate, statusLabel } from "@/components/portal/portal-format";

export default async function PortalDashboardPage() {
  const ctx = await getPortalContext();
  const data = await getPortalDashboard(ctx.orgId);

  const stats = [
    { label: "Ongoing shipments", value: data.jobsOngoing },
    { label: "Total shipments", value: data.jobsTotal },
    { label: "Quotations awaiting you", value: data.quotationsAwaiting },
    { label: "Shared documents", value: data.documentsShared },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Welcome, {ctx.userName}</h1>
      <p className="mb-6 text-sm text-text-secondary">A read-only view of your organization&apos;s shipments with Seawave.</p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-3xl font-semibold text-text-primary">{s.value}</p>
            <p className="mt-1 text-sm text-text-secondary">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Recent shipments</h2>
        <Link href="/portal/jobs" className="text-sm text-brand-teal underline">
          View all
        </Link>
      </div>

      <Card>
        {data.recentJobs.length === 0 ? (
          <p className="text-sm text-text-secondary">No shipments yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {data.recentJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/portal/jobs/${j.id}`} className="font-medium text-brand-teal underline">
                    {j.ref}
                  </Link>
                  <p className="truncate text-xs text-text-tertiary">
                    {j.shipmentType} · {j.route}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-text-tertiary">{shortDate(j.updatedAt)}</span>
                  <Badge variant={jobStatusVariant(j.status)}>{statusLabel(j.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
