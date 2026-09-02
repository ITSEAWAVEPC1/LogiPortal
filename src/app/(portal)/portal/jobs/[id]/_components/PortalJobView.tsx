import { Badge, Card } from "@/components/ui";
import type { DocumentCard } from "@/components/documents/types";
import { DOCUMENT_KIND_LABEL } from "@/components/documents/types";
import type { PortalJob } from "@/lib/portal/queries";
import { jobStatusVariant, money, shortDate, statusLabel } from "@/components/portal/portal-format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="text-sm text-text-primary">{value ?? "—"}</dd>
    </div>
  );
}

function Party({ title, party }: { title: string; party: PortalJob["parties"]["shipper"] }) {
  if (!party) return null;
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</p>
      <p className="text-sm font-medium text-text-primary">{party.name ?? "—"}</p>
      {party.address && <p className="text-sm text-text-secondary">{party.address}</p>}
      {(party.contactPerson || party.phone || party.email) && (
        <p className="mt-1 text-xs text-text-tertiary">
          {[party.contactPerson, party.phone, party.email].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function stepDot(status: "completed" | "active" | "pending") {
  if (status === "completed") return "bg-brand-teal";
  if (status === "active") return "bg-brand-plum";
  return "bg-border-subtle";
}

export function PortalJobView({ job, documents }: { job: PortalJob; documents: DocumentCard[] }) {
  const r = job.routing;
  const c = job.cargo;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">{job.ref}</h1>
          <Badge variant="neutral">{job.shipmentType}</Badge>
          <Badge variant={jobStatusVariant(job.status)}>{statusLabel(job.status)}</Badge>
        </div>
        <p className="text-sm text-text-secondary">
          {job.incoterm ? `Incoterm ${job.incoterm} · ` : ""}Created {shortDate(job.createdAt)}
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Routing &amp; vessel</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Place of receipt" value={r.placeOfReceipt} />
          <Field label="Port of loading" value={r.portOfLoading} />
          <Field label="Port of discharge" value={r.portOfDischarge} />
          <Field label="Place of delivery" value={r.placeOfDelivery} />
          <Field label="Vessel / voyage" value={[r.vesselName, r.voyageNumber].filter(Boolean).join(" / ") || null} />
          <Field label="Shipping line" value={r.shippingLineName} />
          <Field label="Free days at POD" value={r.freeDaysAtPod} />
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Cargo</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Commodity" value={c.commodity} />
          <Field label="HS code" value={c.hsCode} />
          <Field label="Gross weight" value={c.totalGrossWeight} />
          <Field label="Net weight" value={c.totalNetWeight} />
          <Field label="Packages" value={c.totalPackages} />
          <Field label="Volume (CBM)" value={c.volumeCbm} />
        </dl>
      </Card>

      {(job.parties.shipper || job.parties.consignee || job.parties.notifyParty) && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Parties</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            <Party title="Shipper" party={job.parties.shipper} />
            <Party title="Consignee" party={job.parties.consignee} />
            <Party title="Notify party" party={job.parties.notifyParty} />
          </div>
        </Card>
      )}

      {job.containers.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Containers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-tertiary">
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Count</th>
                  <th className="py-2 pr-4 font-medium">Container no.</th>
                  <th className="py-2 pr-4 font-medium">Seal no.</th>
                  <th className="py-2 pr-4 font-medium">Gross wt.</th>
                  <th className="py-2 pr-4 font-medium">Packages</th>
                </tr>
              </thead>
              <tbody>
                {job.containers.map((ct) => (
                  <tr key={ct.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4">{ct.containerType ?? "—"}</td>
                    <td className="py-2 pr-4">{ct.count ?? "—"}</td>
                    <td className="py-2 pr-4">{ct.containerNumber ?? "—"}</td>
                    <td className="py-2 pr-4">{ct.sealNumber ?? "—"}</td>
                    <td className="py-2 pr-4">{ct.grossWeight ?? "—"}</td>
                    <td className="py-2 pr-4">{ct.packageCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {job.steps.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Progress</h2>
          <ol className="flex flex-col">
            {job.steps.map((s, i) => (
              <li key={s.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${stepDot(s.status)}`} />
                  {i < job.steps.length - 1 && (
                    <span
                      className={`w-0.5 flex-1 ${s.status === "completed" ? "bg-brand-teal" : "bg-border-subtle"}`}
                      style={{ minHeight: "1.25rem" }}
                    />
                  )}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-text-primary">{s.label}</p>
                  <p className="text-xs text-text-tertiary">
                    {s.status === "completed" && s.completedAt
                      ? `Completed ${shortDate(s.completedAt)}`
                      : statusLabel(s.rawStatus)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Charges</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Invoice total" value={money(job.invoice.total, job.invoice.currency)} />
          {job.duty.label && <Field label="Duty" value={job.duty.label} />}
          {job.duty.amount !== null && (
            <Field label="Duty amount (your liability)" value={money(job.duty.amount, job.invoice.currency)} />
          )}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-text-secondary">No documents have been shared for this shipment yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{d.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {d.ref} · {DOCUMENT_KIND_LABEL[d.kind]}
                  </p>
                </div>
                {d.currentVersionId ? (
                  <a
                    href={`/api/portal/documents/${d.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-sm text-brand-teal underline"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-xs text-text-tertiary">—</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
