import { Card } from "@/components/ui";
import type { QuotationPdfData } from "@/lib/pdf/types";

const CATEGORY_LABEL: Record<QuotationPdfData["lineItems"][number]["category"], string> = {
  FREIGHT: "Freight Booking Charges",
  CUSTOMS_CLEARANCE: "Customs Clearance Charges",
  TRANSPORTATION: "Transportation Charges",
  REIMBURSEMENT: "Reimbursement Charges",
};

const CATEGORY_ORDER = ["FREIGHT", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "REIMBURSEMENT"] as const;

// Renders the exact same QuotationPdfData shape as the PDF route — used both
// as the automatic fallback when PDF generation fails and as an in-app
// preview before download.
export function QuotationHtmlPreview({ data }: { data: QuotationPdfData }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold text-brand-teal">Quotation {data.ref}</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Version {data.versionNumber} · {data.status.replace(/_/g, " ")}
        {data.approvedAt ? ` · Approved ${new Date(data.approvedAt).toLocaleDateString()}` : ""}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-text-tertiary">Customer</p>
          <p className="text-text-primary">{data.organizationName}</p>
          <p className="mt-2 text-xs uppercase text-text-tertiary">Branch</p>
          <p className="text-text-primary">{data.branchName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-text-tertiary">Prepared By</p>
          <p className="text-text-primary">{data.createdByName}</p>
          <p className="mt-2 text-xs uppercase text-text-tertiary">Date</p>
          <p className="text-text-primary">{new Date(data.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <p className="text-xs uppercase text-text-tertiary">Enquiries Covered</p>
      <ul className="mb-4 text-sm text-text-primary">
        {data.enquiries.map((e) => (
          <li key={e.id}>
            {e.ref} — {e.shipmentType ?? "—"} ({e.serviceTypes.join(", ") || "—"})
          </li>
        ))}
      </ul>

      {CATEGORY_ORDER.map((category) => {
        const items = data.lineItems.filter((li) => li.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="mb-3">
            <h3 className="border-b border-border-subtle pb-1 text-sm font-semibold text-text-primary">
              {CATEGORY_LABEL[category]}
            </h3>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between py-1 text-sm">
                <span className="text-text-primary">{item.description}</span>
                <span className="text-text-secondary">
                  {item.currency} {item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      <div className="mt-3 flex justify-between border-t border-text-primary pt-2 text-base font-semibold text-text-primary">
        <span>Total</span>
        <span>
          {data.currency} {data.totalAmount.toFixed(2)}
        </span>
      </div>
    </Card>
  );
}
