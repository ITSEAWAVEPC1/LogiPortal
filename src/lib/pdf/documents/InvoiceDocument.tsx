import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { InvoicePdfData } from "../types";
import { docStyles as s, orDash } from "./styles";
import { DocFooter, DocHeader } from "./Shared";

const CATEGORY_LABEL: Record<string, string> = {
  FREIGHT: "Freight Charges",
  CUSTOMS_CLEARANCE: "Customs Clearance Charges",
  TRANSPORTATION: "Transportation Charges",
  REIMBURSEMENT: "Reimbursement Charges",
};
const CATEGORY_ORDER = ["FREIGHT", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "REIMBURSEMENT"];

// Full layout — "Bill Preparation: As per Quotation". Line items come from the
// Job's `charges` snapshot (copied from the converted quotation, adjustable by
// Accounts).
export function InvoiceDocument({ data, draft }: { data: InvoicePdfData; draft?: boolean }) {
  const known = CATEGORY_ORDER.filter((c) => data.lineItems.some((li) => li.category === c));
  const extra = [...new Set(data.lineItems.map((li) => li.category))].filter((c) => !CATEGORY_ORDER.includes(c));
  const categories = [...known, ...extra];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocHeader data={data} draft={draft} />

        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.label}>Bill To</Text>
            <Text style={s.value}>{data.organizationName}</Text>
            <Text style={s.label}>Consignee</Text>
            <Text style={s.value}>{orDash(data.consignee.name)}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>Job Reference</Text>
            <Text style={s.value}>{data.jobRef}</Text>
            <Text style={s.label}>Route</Text>
            <Text style={s.value}>
              {orDash(data.routing.portOfLoading)} → {orDash(data.routing.portOfDischarge)}
            </Text>
          </View>
        </View>

        {categories.length === 0 ? (
          <Text style={s.value}>No charge lines recorded on this Job.</Text>
        ) : (
          categories.map((cat) => {
            const items = data.lineItems.filter((li) => li.category === cat);
            return (
              <View key={cat}>
                <Text style={s.sectionTitle}>{CATEGORY_LABEL[cat] ?? cat}</Text>
                {items.map((li, i) => (
                  <View key={i} style={s.tr}>
                    <Text style={[s.td, s.cellWide]}>{li.description || "—"}</Text>
                    <Text style={[s.td, s.cellRight]}>
                      {li.currency} {li.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}

        <View style={s.totalRow}>
          <Text>Total</Text>
          <Text>
            {data.invoiceCurrency} {data.total.toFixed(2)}
          </Text>
        </View>

        <Text style={s.note}>
          Prepared as per the approved quotation. Amounts are exclusive of taxes unless stated. This is a system-generated
          invoice for the above Job.
        </Text>

        <DocFooter data={data} />
      </Page>
    </Document>
  );
}
