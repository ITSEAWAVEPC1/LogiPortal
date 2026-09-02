import { Fragment } from "react";
import { Badge, Card } from "@/components/ui";
import { QUOTATION_CHARGE_CATEGORY_OPTIONS } from "@/lib/validation/quotation";
import type { PortalQuotation } from "@/lib/portal/queries";
import { money, quotationStatusVariant, shortDate, statusLabel } from "@/components/portal/portal-format";

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  QUOTATION_CHARGE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

export function PortalQuotationView({ quotation }: { quotation: PortalQuotation }) {
  const grouped = QUOTATION_CHARGE_CATEGORY_OPTIONS.map((cat) => ({
    category: cat.value,
    label: cat.label,
    items: quotation.lineItems.filter((li) => li.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">{quotation.ref}</h1>
          <Badge variant={quotationStatusVariant(quotation.status)}>{statusLabel(quotation.status)}</Badge>
          <span className="text-sm text-text-tertiary">v{quotation.versionNumber}</span>
        </div>
        <p className="text-sm text-text-secondary">
          Created {shortDate(quotation.createdAt)}
          {quotation.sentAt ? ` · Sent ${shortDate(quotation.sentAt)}` : ""}
          {quotation.approvedAt ? ` · Approved ${shortDate(quotation.approvedAt)}` : ""}
        </p>
      </div>

      {quotation.enquiries.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Covered enquiries</h2>
          <ul className="flex flex-wrap gap-2">
            {quotation.enquiries.map((e) => (
              <li key={e.id} className="rounded-md border border-border-subtle px-3 py-1 text-sm text-text-secondary">
                {e.ref} · {e.shipmentType}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Charges</h2>
        {grouped.length === 0 ? (
          <p className="text-sm text-text-secondary">No line items on this version.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {grouped.map((g) => (
                  <Fragment key={g.category}>
                    <tr className="border-b border-border-subtle">
                      <td colSpan={3} className="py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                        {CATEGORY_LABEL[g.category] ?? g.label}
                      </td>
                    </tr>
                    {g.items.map((li) => (
                      <tr key={li.id} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-4">{li.description}</td>
                        <td className="py-2 pr-4 text-right text-text-tertiary">
                          {li.quantity != null && li.rate != null ? `${li.quantity} × ${money(li.rate, li.currency)}` : ""}
                        </td>
                        <td className="py-2 pr-4 text-right">{money(li.amount, li.currency)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border-subtle">
                  <td className="py-2 font-semibold text-text-primary">Total</td>
                  <td />
                  <td className="py-2 pr-4 text-right font-semibold text-text-primary">
                    {money(quotation.total, quotation.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div>
        <a
          href={`/api/portal/quotations/${quotation.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-brand-teal underline"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
