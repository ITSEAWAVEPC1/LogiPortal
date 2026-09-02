import { Text, View } from "@react-pdf/renderer";
import type { DocumentPdfBase, DocPartyBlock, DocContainerRow } from "../types";
import { docStyles as s, fmtNum, orDash } from "./styles";

export function DocHeader({ data, draft }: { data: DocumentPdfBase; draft?: boolean }) {
  return (
    <>
      <View style={s.brandBar}>
        <Text style={s.brand}>Seawave Forwarding &amp; Logistics</Text>
        <Text style={s.label}>{data.ref}</Text>
      </View>
      <Text style={s.title}>{data.title}</Text>
      <Text style={s.subtitle}>
        Job {data.jobRef} · {data.shipmentType}
        {data.incoterm ? ` · ${data.incoterm}` : ""} · Generated {new Date(data.generatedAt).toLocaleString()}
        {draft ? "  —  " : ""}
        {draft ? <Text style={s.draftMark}>Draft — pending approval</Text> : null}
      </Text>
      <View style={s.rule} />
    </>
  );
}

export function DocFooter({ data }: { data: DocumentPdfBase }) {
  return (
    <Text style={s.footer} fixed>
      {data.title} · {data.ref} · Job {data.jobRef} · {data.organizationName} · {data.branchName} branch — system-generated
      document, not a substitute for the carrier-issued original.
    </Text>
  );
}

function PartyBox({ label, party }: { label: string; party: DocPartyBlock }) {
  const lines = [party.address, party.contactPerson, party.phone, party.email].filter((l): l is string => !!l && !!l.trim());
  return (
    <View style={s.partyBox}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.partyName}>{orDash(party.name)}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={s.partyLine}>
          {l}
        </Text>
      ))}
    </View>
  );
}

export function PartyGrid({ data }: { data: DocumentPdfBase }) {
  return (
    <>
      <View style={s.grid2}>
        <PartyBox label="Shipper" party={data.shipper} />
        <PartyBox label="Consignee" party={data.consignee} />
      </View>
      <View style={s.grid2}>
        <PartyBox label="Notify Party" party={data.notifyParty} />
        <View style={s.partyBox}>
          <Text style={s.label}>Vessel / Voyage</Text>
          <Text style={s.partyName}>{orDash(data.routing.vesselName)}</Text>
          <Text style={s.partyLine}>Voyage {orDash(data.routing.voyageNumber)}</Text>
          <Text style={s.partyLine}>Line {orDash(data.routing.shippingLineName)}</Text>
        </View>
      </View>
    </>
  );
}

export function RoutingGrid({ data }: { data: DocumentPdfBase }) {
  const r = data.routing;
  return (
    <View style={s.grid2}>
      <View style={s.col}>
        <Text style={s.label}>Place of Receipt</Text>
        <Text style={s.value}>{orDash(r.placeOfReceipt)}</Text>
        <Text style={s.label}>Port of Loading</Text>
        <Text style={s.value}>{orDash(r.portOfLoading)}</Text>
      </View>
      <View style={s.col}>
        <Text style={s.label}>Port of Discharge</Text>
        <Text style={s.value}>{orDash(r.portOfDischarge)}</Text>
        <Text style={s.label}>Place of Delivery</Text>
        <Text style={s.value}>{orDash(r.placeOfDelivery)}</Text>
      </View>
    </View>
  );
}

export function ContainerTable({ containers }: { containers: DocContainerRow[] }) {
  return (
    <>
      <Text style={s.sectionTitle}>Containers &amp; Cargo</Text>
      {containers.length === 0 ? (
        <Text style={s.value}>No container rows recorded.</Text>
      ) : (
        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.th, s.cell]}>Container No.</Text>
            <Text style={[s.th, s.cell]}>Seal No.</Text>
            <Text style={[s.th, s.cell]}>Type</Text>
            <Text style={[s.th, s.cellRight]}>Count</Text>
            <Text style={[s.th, s.cellRight]}>Gross Wt</Text>
            <Text style={[s.th, s.cellRight]}>Pkgs</Text>
          </View>
          {containers.map((c, i) => (
            <View key={i} style={s.tr}>
              <Text style={[s.td, s.cell]}>{orDash(c.containerNumber)}</Text>
              <Text style={[s.td, s.cell]}>{orDash(c.sealNumber)}</Text>
              <Text style={[s.td, s.cell]}>{orDash(c.containerType)}</Text>
              <Text style={[s.td, s.cellRight]}>{fmtNum(c.count)}</Text>
              <Text style={[s.td, s.cellRight]}>{fmtNum(c.grossWeight)}</Text>
              <Text style={[s.td, s.cellRight]}>{fmtNum(c.packageCount)}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

export function CargoTotals({ data }: { data: DocumentPdfBase }) {
  return (
    <View style={[s.grid2, { marginTop: 8 }]}>
      <View style={s.col}>
        <Text style={s.label}>Total Gross Weight</Text>
        <Text style={s.value}>{fmtNum(data.totalGrossWeight, " kg")}</Text>
        <Text style={s.label}>Total Net Weight</Text>
        <Text style={s.value}>{fmtNum(data.totalNetWeight, " kg")}</Text>
      </View>
      <View style={s.col}>
        <Text style={s.label}>Total Packages</Text>
        <Text style={s.value}>{fmtNum(data.totalPackages)}</Text>
        <Text style={s.label}>Volume (CBM)</Text>
        <Text style={s.value}>{fmtNum(data.volumeCbm)}</Text>
      </View>
    </View>
  );
}
