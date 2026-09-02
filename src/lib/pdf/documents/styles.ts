import { StyleSheet } from "@react-pdf/renderer";

// Shared document styling — brand hexes lifted from src/styles/tokens.css /
// QuotationDocument.tsx so every Stage 7 PDF reads as one family.
export const docStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#2B2A26" },
  brandBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  brand: { fontSize: 13, fontWeight: 700, color: "#2FA8B5" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#8A8578", marginBottom: 14 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#E5E1D8", marginBottom: 12 },

  grid2: { flexDirection: "row", gap: 16, marginBottom: 12 },
  col: { flex: 1, flexDirection: "column", gap: 2 },

  label: { fontSize: 7.5, color: "#8A8578", textTransform: "uppercase", marginBottom: 1 },
  value: { fontSize: 10, marginBottom: 6 },

  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E1D8",
    borderRadius: 3,
    padding: 8,
  },
  partyName: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 9, color: "#2B2A26" },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E1D8",
  },

  table: { marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0EDE5", paddingVertical: 3 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2B2A26", paddingBottom: 3 },
  th: { fontSize: 7.5, color: "#8A8578", textTransform: "uppercase" },
  td: { fontSize: 9 },
  cellWide: { flex: 2 },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: "right" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2B2A26",
    fontSize: 12,
    fontWeight: 700,
  },

  note: { marginTop: 14, fontSize: 8, color: "#8A8578" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7.5, color: "#A6A192", textAlign: "center" },
  draftMark: { fontSize: 8, color: "#9B4A82", fontWeight: 700, textTransform: "uppercase" },
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString();
}

export function fmtNum(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toLocaleString()}${suffix}`;
}

export function orDash(s: string | null | undefined): string {
  return s && s.trim() ? s : "—";
}
