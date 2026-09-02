import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { MblPdfData } from "../types";
import { docStyles as s, fmtDate, orDash } from "./styles";
import { CargoTotals, ContainerTable, DocFooter, DocHeader, PartyGrid, RoutingGrid } from "./Shared";

// Stage 7 fidelity decision: a clean branded stub; the carrier's own MBL copy
// is uploaded against the MBL Details workflow step.
export function MblDocument({ data, draft }: { data: MblPdfData; draft?: boolean }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocHeader data={data} draft={draft} />
        <PartyGrid data={data} />
        <RoutingGrid data={data} />

        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.label}>MBL No.</Text>
            <Text style={s.value}>{orDash(data.mblNumber)}</Text>
            <Text style={s.label}>MBL Date</Text>
            <Text style={s.value}>{fmtDate(data.mblDate)}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>BL Type</Text>
            <Text style={s.value}>{orDash(data.blType)}</Text>
            <Text style={s.label}>BL No. / Date</Text>
            <Text style={s.value}>
              {orDash(data.blNumber)}
              {data.blDate ? ` · ${fmtDate(data.blDate)}` : ""}
            </Text>
          </View>
        </View>

        <ContainerTable containers={data.containers} />
        <CargoTotals data={data} />

        <Text style={s.note}>
          Master Bill of Lading reference — carrier: {orDash(data.routing.shippingLineName)}. This is a Seawave system
          copy for internal tracking; the carrier-issued MBL is the governing instrument.
        </Text>
        <DocFooter data={data} />
      </Page>
    </Document>
  );
}
