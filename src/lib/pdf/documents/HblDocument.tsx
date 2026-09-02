import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { HblPdfData } from "../types";
import { docStyles as s, fmtDate, orDash } from "./styles";
import { CargoTotals, ContainerTable, DocFooter, DocHeader, PartyGrid, RoutingGrid } from "./Shared";

// Stage 7 fidelity decision: a clean branded stub. The operationally
// authoritative HBL is the carrier-issued copy uploaded against this Job.
export function HblDocument({ data, draft }: { data: HblPdfData; draft?: boolean }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <DocHeader data={data} draft={draft} />
        <PartyGrid data={data} />
        <RoutingGrid data={data} />

        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.label}>HBL No.</Text>
            <Text style={s.value}>{orDash(data.hblNumber)}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>HBL Date</Text>
            <Text style={s.value}>{fmtDate(data.hblDate)}</Text>
          </View>
        </View>

        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.label}>Commodity</Text>
            <Text style={s.value}>{orDash(data.commodity)}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>HS Code</Text>
            <Text style={s.value}>{orDash(data.hsCode)}</Text>
          </View>
        </View>

        <ContainerTable containers={data.containers} />
        <CargoTotals data={data} />

        <Text style={s.note}>
          House Bill of Lading — issued by Seawave Forwarding &amp; Logistics as freight forwarder. Subject to the standard
          trading conditions. This system copy is generated from the Job record; the signed original governs.
        </Text>
        <DocFooter data={data} />
      </Page>
    </Document>
  );
}
