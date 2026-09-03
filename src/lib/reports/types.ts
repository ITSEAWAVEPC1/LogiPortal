// Stage 10b — shared report shapes.
import type { Period } from "./period";

export interface ReportFilters {
  period: Period;
  /** ADMIN-only narrowing; a BRANCH_MANAGER is already pinned to their branch by scope. */
  branchId?: string;
  /** revenue report only */
  organizationId?: string;
  /** revenue report only — a ServiceType enum value */
  serviceType?: string;
}

export interface ReportColumn {
  key: string;
  header: string;
  /** right-align + tabular-nums in the table */
  numeric?: boolean;
  /** format numeric cells as INR currency (implies numeric) */
  money?: boolean;
}

/** A generic table payload the report pages and the CSV route both render. */
export interface ReportTable {
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  /** optional footer row (totals) */
  total?: Record<string, string | number | null>;
}

export interface ReportChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ReportChart {
  kind: "bar" | "line";
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: ReportChartSeries[];
}

export interface ReportResult {
  /** the primary table — always present, and what the CSV export writes first */
  table: ReportTable;
  /** additional labelled breakdown tables (revenue: by customer / service type) */
  extraTables?: Array<{ title: string; table: ReportTable }>;
  chart?: ReportChart;
  /** currency-agnostic note when amounts span multiple currencies */
  note?: string;
}
