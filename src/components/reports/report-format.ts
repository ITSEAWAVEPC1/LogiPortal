import type { ReportColumn } from "@/lib/reports/types";

export function formatReportCell(
  value: string | number | null | undefined,
  col: Pick<ReportColumn, "numeric" | "money">,
): string {
  if (value === null || value === undefined || value === "") {
    return col.numeric || col.money ? "0" : "";
  }
  if (typeof value === "number") {
    if (col.money) return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    if (col.numeric) return value.toLocaleString("en-IN");
    return String(value);
  }
  return String(value);
}
