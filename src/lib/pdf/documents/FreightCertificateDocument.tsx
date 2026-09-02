import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { FreightCertificatePdfData } from "../types";
import { docStyles as s, fmtDate, fmtNum, orDash } from "./styles";
import { DocFooter, DocHeader } from "./Shared";

// Full layout — the 9 figures are fully specified by the source process
// (docs/original-process-reference.pdf p.4) and captured on the
// `freight_certificate_prep` workflow step.
export function FreightCertificateDocument({
  data,
  draft,
}: {
  data: FreightCertificatePdfData;
  draft?: boolean;
}) {
  const row = (label: string, value: string) => (
    <View style={s.tr}>
      <Text style={[s.td, s.cellWide]}>{label}</Text>
      <Text style={[s.td, s.cell]}>{value}</Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocHeader data={data} draft={draft} />

        <Text style={s.value}>
          This is to certify the freight particulars for the shipment referenced below, forwarded by Seawave Forwarding
          &amp; Logistics on behalf of the shipper.
        </Text>

        <Text style={s.sectionTitle}>Certificate Particulars</Text>
        <View style={s.table}>
          {row("Certificate Date", fmtDate(data.certificateDate))}
          {row("Shipper Name", orDash(data.fcShipperName))}
          {row("Consignee Name", orDash(data.fcConsigneeName))}
          {row("Port of Loading", orDash(data.fcPortOfLoading))}
          {row("Port of Discharge", orDash(data.fcPortOfDischarge))}
          {row("HBL No. & Date", orDash(data.hblNumberDate))}
          {row("MBL No. & Date", orDash(data.mblNumberDate))}
          {row("Ocean Freight (USD)", fmtNum(data.oceanFreightUsd))}
          {row("Ex-Works (USD)", fmtNum(data.exWorksUsd))}
        </View>

        <Text style={s.note}>
          Issued for customs / banking purposes. Figures are as declared on the Freight Certificate Preparation step and
          verified by Accounts. Job {data.jobRef} · {data.shipmentType}
          {data.incoterm ? ` · ${data.incoterm}` : ""}.
        </Text>

        <View style={{ marginTop: 40 }}>
          <Text style={s.label}>For Seawave Forwarding &amp; Logistics Pvt. Ltd.</Text>
          <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: "#2B2A26", width: 180 }} />
          <Text style={s.partyLine}>Authorised Signatory</Text>
        </View>

        <DocFooter data={data} />
      </Page>
    </Document>
  );
}
