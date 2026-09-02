import { Card } from "@/components/ui";
import type { DocumentPdfData, DocumentPdfBase, DocPartyBlock } from "@/lib/pdf/types";

// Renders the same DocumentPdfData shape as the PDF — used as the automatic
// fallback when generation fails (the file route returns { fallback, data }
// from the retained sourceSnapshot), mirroring QuotationHtmlPreview.

function d(v: string | null | undefined) {
  return v && String(v).trim() ? String(v) : "—";
}
function n(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : v.toLocaleString();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-text-tertiary">{label}</p>
      <p className="text-text-primary">{value}</p>
    </div>
  );
}

function Party({ label, p }: { label: string; p: DocPartyBlock }) {
  return (
    <div className="rounded border border-border-subtle p-2">
      <p className="text-xs uppercase text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary">{d(p.name)}</p>
      {[p.address, p.contactPerson, p.phone, p.email]
        .filter((l): l is string => !!l && !!l.trim())
        .map((l, i) => (
          <p key={i} className="text-sm text-text-secondary">
            {l}
          </p>
        ))}
    </div>
  );
}

function CommonBlocks({ base }: { base: DocumentPdfBase }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Party label="Shipper" p={base.shipper} />
        <Party label="Consignee" p={base.consignee} />
        <Party label="Notify Party" p={base.notifyParty} />
        <div className="rounded border border-border-subtle p-2">
          <p className="text-xs uppercase text-text-tertiary">Vessel / Voyage</p>
          <p className="font-semibold text-text-primary">{d(base.routing.vesselName)}</p>
          <p className="text-sm text-text-secondary">Voyage {d(base.routing.voyageNumber)}</p>
          <p className="text-sm text-text-secondary">Line {d(base.routing.shippingLineName)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
        <Field label="Place of Receipt" value={d(base.routing.placeOfReceipt)} />
        <Field label="Port of Loading" value={d(base.routing.portOfLoading)} />
        <Field label="Port of Discharge" value={d(base.routing.portOfDischarge)} />
        <Field label="Place of Delivery" value={d(base.routing.placeOfDelivery)} />
      </div>
      {base.containers.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-text-primary text-left text-xs uppercase text-text-tertiary">
              <th className="py-1">Container</th>
              <th className="py-1">Seal</th>
              <th className="py-1">Type</th>
              <th className="py-1 text-right">Count</th>
              <th className="py-1 text-right">Gross Wt</th>
              <th className="py-1 text-right">Pkgs</th>
            </tr>
          </thead>
          <tbody>
            {base.containers.map((c, i) => (
              <tr key={i} className="border-b border-border-subtle">
                <td className="py-1">{d(c.containerNumber)}</td>
                <td className="py-1">{d(c.sealNumber)}</td>
                <td className="py-1">{d(c.containerType)}</td>
                <td className="py-1 text-right">{n(c.count)}</td>
                <td className="py-1 text-right">{n(c.grossWeight)}</td>
                <td className="py-1 text-right">{n(c.packageCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function DocumentHtmlPreview({ data }: { data: DocumentPdfData }) {
  return (
    <Card className="mx-auto max-w-2xl">
      <p className="text-xs uppercase text-text-tertiary">Preview (generation fell back to HTML)</p>
      <h2 className="text-xl font-semibold text-brand-teal">
        {data.title} <span className="text-sm font-normal text-text-secondary">{data.ref}</span>
      </h2>
      <p className="mb-4 text-sm text-text-secondary">
        Job {data.jobRef} · {data.shipmentType}
        {data.incoterm ? ` · ${data.incoterm}` : ""} · {data.organizationName}
      </p>

      {data.kind === "INVOICE" ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <Field label="Bill To" value={data.organizationName} />
            <Field label="Consignee" value={d(data.consignee.name)} />
          </div>
          {data.lineItems.length === 0 ? (
            <p className="text-sm text-text-secondary">No charge lines recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.lineItems.map((li, i) => (
                  <tr key={i} className="border-b border-border-subtle">
                    <td className="py-1 text-text-primary">
                      <span className="text-xs uppercase text-text-tertiary">{li.category}</span> {li.description || "—"}
                    </td>
                    <td className="py-1 text-right text-text-secondary">
                      {li.currency} {li.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex justify-between border-t border-text-primary pt-2 text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>
              {data.invoiceCurrency} {data.total.toFixed(2)}
            </span>
          </div>
        </>
      ) : data.kind === "FREIGHT_CERTIFICATE" ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Certificate Date" value={d(data.certificateDate)} />
          <Field label="Shipper" value={d(data.fcShipperName)} />
          <Field label="Consignee" value={d(data.fcConsigneeName)} />
          <Field label="Port of Loading" value={d(data.fcPortOfLoading)} />
          <Field label="Port of Discharge" value={d(data.fcPortOfDischarge)} />
          <Field label="HBL No. & Date" value={d(data.hblNumberDate)} />
          <Field label="MBL No. & Date" value={d(data.mblNumberDate)} />
          <Field label="Ocean Freight (USD)" value={n(data.oceanFreightUsd)} />
          <Field label="Ex-Works (USD)" value={n(data.exWorksUsd)} />
        </div>
      ) : (
        <>
          <CommonBlocks base={data} />
          {data.kind === "HBL" && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field label="HBL No." value={d(data.hblNumber)} />
              <Field label="HBL Date" value={d(data.hblDate)} />
            </div>
          )}
          {data.kind === "MBL" && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field label="MBL No." value={d(data.mblNumber)} />
              <Field label="MBL Date" value={d(data.mblDate)} />
              <Field label="BL Type" value={d(data.blType)} />
              <Field label="BL No. / Date" value={`${d(data.blNumber)}${data.blDate ? ` · ${data.blDate}` : ""}`} />
            </div>
          )}
          {data.kind === "DELIVERY_ORDER" && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field label="DO Release Date" value={d(data.deliveryOrderDate)} />
              <Field label="CFS" value={d(data.routing.cfsName)} />
              <Field label="Free Days at POD" value={n(data.freeDaysAtPod)} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
