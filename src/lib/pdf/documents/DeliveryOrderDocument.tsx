import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { DeliveryOrderPdfData } from "../types";
import { docStyles as s, fmtDate, fmtNum, orDash } from "./styles";
import { ContainerTable, DocFooter, DocHeader, RoutingGrid } from "./Shared";

// Stage 7 fidelity decision: a clean branded stub. The signed DO from the line
// / CFS is uploaded against the Delivery Order Release step.
export function DeliveryOrderDocument({ data, draft }: { data: DeliveryOrderPdfData; draft?: boolean }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocHeader data={data} draft={draft} />

        <View style={s.grid2}>
          <View style={s.partyBox}>
            <Text style={s.label}>Deliver To (Consignee)</Text>
            <Text style={s.partyName}>{orDash(data.consignee.name)}</Text>
            {[data.consignee.address, data.consignee.contactPerson, data.consignee.phone]
              .filter((l): l is string => !!l && !!l.trim())
              .map((l, i) => (
                <Text key={i} style={s.partyLine}>
                  {l}
                </Text>
              ))}
          </View>
          <View style={s.col}>
            <Text style={s.label}>DO Release Date</Text>
            <Text style={s.value}>{fmtDate(data.deliveryOrderDate)}</Text>
            <Text style={s.label}>CFS</Text>
            <Text style={s.value}>{orDash(data.routing.cfsName)}</Text>
            <Text style={s.label}>Free Days at POD</Text>
            <Text style={s.value}>{fmtNum(data.freeDaysAtPod)}</Text>
          </View>
        </View>

        <RoutingGrid data={data} />

        <Text style={s.sectionTitle}>Authorisation</Text>
        <Text style={s.value}>
          Please deliver the under-mentioned cargo to the consignee named above against surrender of the original bill of
          lading and settlement of all applicable charges. Vessel {orDash(data.routing.vesselName)} / Voyage{" "}
          {orDash(data.routing.voyageNumber)}.
        </Text>

        <ContainerTable containers={data.containers} />

        <DocFooter data={data} />
      </Page>
    </Document>
  );
}
