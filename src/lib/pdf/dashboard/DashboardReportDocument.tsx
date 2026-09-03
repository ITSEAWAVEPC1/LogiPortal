import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DashboardReportData } from "./build-dashboard-report-data";

// Brand hexes from src/styles/tokens.css — same family as the Stage 7 documents.
const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#2B2A26" },
  brand: { fontSize: 13, fontWeight: 700, color: "#2FA8B5" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  subtitle: { fontSize: 9, color: "#8A8578", marginBottom: 14 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#E5E1D8", marginVertical: 10 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  kpiBox: { flex: 1, borderWidth: 1, borderColor: "#E5E1D8", borderRadius: 3, padding: 8 },
  kpiLabel: { fontSize: 7.5, color: "#8A8578", textTransform: "uppercase", marginBottom: 3 },
  kpiValue: { fontSize: 14, fontWeight: 700 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E1D8",
  },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2B2A26", paddingBottom: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0EDE5", paddingVertical: 3 },
  trTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2B2A26", paddingTop: 4, marginTop: 2 },
  th: { fontSize: 7.5, color: "#8A8578", textTransform: "uppercase" },
  td: { fontSize: 9 },
  cLeft: { flex: 2 },
  cNum: { flex: 1, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: "#A6A192",
    textAlign: "center",
  },
});

const inr = (n: number) => `INR ${Math.round(n).toLocaleString("en-IN")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function DashboardReportDocument({ data }: { data: DashboardReportData }) {
  const branchTotal = data.branchRows.reduce(
    (a, r) => ({
      jobsCreated: a.jobsCreated + r.jobsCreated,
      jobsDelivered: a.jobsDelivered + r.jobsDelivered,
      revenue: a.revenue + r.revenue,
    }),
    { jobsCreated: 0, jobsDelivered: 0, revenue: 0 },
  );
  const revTotal = data.revenueByMonth.reduce(
    (a, r) => ({ quoted: a.quoted + r.quoted, converted: a.converted + r.converted }),
    { quoted: 0, converted: 0 },
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>Seawave Forwarding &amp; Logistics</Text>
        <Text style={s.title}>Management dashboard report</Text>
        <Text style={s.subtitle}>
          {data.scopeLabel} · {data.periodLabel} · generated {fmtDate(data.generatedAt)}
        </Text>

        <View style={s.kpiRow}>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Jobs created</Text>
            <Text style={s.kpiValue}>{data.kpis.jobsCreated.toLocaleString("en-IN")}</Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>On-time delivery</Text>
            <Text style={s.kpiValue}>
              {data.kpis.onTimeRate === null ? "—" : `${(data.kpis.onTimeRate * 100).toFixed(1)}%`}
            </Text>
          </View>
          <View style={s.kpiBox}>
            <Text style={s.kpiLabel}>Revenue (quoted)</Text>
            <Text style={s.kpiValue}>{inr(data.kpis.revenue)}</Text>
          </View>
        </View>
        <Text style={s.td}>{data.kpis.jobsDelivered.toLocaleString("en-IN")} jobs delivered in the period.</Text>

        <Text style={s.sectionTitle}>Branch performance</Text>
        <View style={s.thRow}>
          <Text style={[s.th, s.cLeft]}>Branch</Text>
          <Text style={[s.th, s.cNum]}>Created</Text>
          <Text style={[s.th, s.cNum]}>Delivered</Text>
          <Text style={[s.th, s.cNum]}>On-time</Text>
          <Text style={[s.th, s.cNum]}>Revenue</Text>
        </View>
        {data.branchRows.map((r) => (
          <View key={r.branch} style={s.tr}>
            <Text style={[s.td, s.cLeft]}>{r.branch}</Text>
            <Text style={[s.td, s.cNum]}>{r.jobsCreated.toLocaleString("en-IN")}</Text>
            <Text style={[s.td, s.cNum]}>{r.jobsDelivered.toLocaleString("en-IN")}</Text>
            <Text style={[s.td, s.cNum]}>{r.onTime}</Text>
            <Text style={[s.td, s.cNum]}>{inr(r.revenue)}</Text>
          </View>
        ))}
        <View style={s.trTotal}>
          <Text style={[s.td, s.cLeft, { fontWeight: 700 }]}>All branches</Text>
          <Text style={[s.td, s.cNum, { fontWeight: 700 }]}>
            {branchTotal.jobsCreated.toLocaleString("en-IN")}
          </Text>
          <Text style={[s.td, s.cNum, { fontWeight: 700 }]}>
            {branchTotal.jobsDelivered.toLocaleString("en-IN")}
          </Text>
          <Text style={[s.td, s.cNum]}> </Text>
          <Text style={[s.td, s.cNum, { fontWeight: 700 }]}>{inr(branchTotal.revenue)}</Text>
        </View>

        <Text style={s.sectionTitle}>Revenue by month</Text>
        <View style={s.thRow}>
          <Text style={[s.th, s.cLeft]}>Month</Text>
          <Text style={[s.th, s.cNum]}>Quoted</Text>
          <Text style={[s.th, s.cNum]}>Converted</Text>
        </View>
        {data.revenueByMonth.map((r) => (
          <View key={r.month} style={s.tr}>
            <Text style={[s.td, s.cLeft]}>{r.month}</Text>
            <Text style={[s.td, s.cNum]}>{inr(r.quoted)}</Text>
            <Text style={[s.td, s.cNum]}>{inr(r.converted)}</Text>
          </View>
        ))}
        <View style={s.trTotal}>
          <Text style={[s.td, s.cLeft, { fontWeight: 700 }]}>Total</Text>
          <Text style={[s.td, s.cNum, { fontWeight: 700 }]}>{inr(revTotal.quoted)}</Text>
          <Text style={[s.td, s.cNum, { fontWeight: 700 }]}>{inr(revTotal.converted)}</Text>
        </View>

        <Text style={s.rule} />
        <Text style={s.td}>
          Amounts are summed as recorded and not currency-converted. On-time = actual delivery on or
          before the expected (ETA-at-POD) date.
        </Text>

        <Text style={s.footer} fixed>
          Seawave Forwarding &amp; Logistics — internal management report
        </Text>
      </Page>
    </Document>
  );
}
