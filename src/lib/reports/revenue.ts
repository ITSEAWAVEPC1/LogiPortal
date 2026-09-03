import { prisma } from "@/lib/db/prisma";
import {
  jobScopeWhere,
  quotationScopeWhere,
  type Scope,
} from "@/lib/permissions/scope";
import type { ServiceType } from "@/generated/prisma/client";
import { bucketKeyForDate, monthBuckets } from "./period";
import { branchWhere, listReportBranches, resolveReportBranchIds } from "./common";
import type { ReportFilters, ReportResult, ReportTable } from "./types";

const SERVICE_LABELS: Record<string, string> = {
  FREIGHT_FORWARDING: "Freight Forwarding",
  CUSTOMS_CLEARANCE: "Customs Clearance",
  TRANSPORTATION: "Transportation",
  WAREHOUSING: "Warehousing",
  EXIM_CONSULTANCY: "Exim Consultancy",
};

// Quoted (current quotation version total, by quotation.createdAt) vs converted
// (Job.quotedTotal where origin = QUOTATION, by job.createdAt) revenue for the
// period, broken down by month / branch / customer / service type. Amounts are
// summed as-is — not currency-converted.
export async function revenueReport(scope: Scope, filters: ReportFilters): Promise<ReportResult> {
  const { period } = filters;
  const branchIds = resolveReportBranchIds(scope, filters.branchId);
  const bWhere = branchWhere(branchIds);
  const orgFilter = filters.organizationId ? { organizationId: filters.organizationId } : {};
  const svcFilter = filters.serviceType
    ? { serviceTypes: { has: filters.serviceType as ServiceType } }
    : {};

  const [branches, quotations, jobs] = await Promise.all([
    listReportBranches(branchIds),
    prisma.quotation.findMany({
      where: {
        ...quotationScopeWhere(scope),
        ...bWhere,
        ...orgFilter,
        createdAt: { gte: period.gte, lt: period.lt },
      },
      select: {
        branchId: true,
        organizationId: true,
        createdAt: true,
        currentVersionNumber: true,
        organization: { select: { name: true } },
        versions: { select: { versionNumber: true, totalAmount: true } },
      },
    }),
    prisma.job.findMany({
      where: {
        ...jobScopeWhere(scope),
        ...bWhere,
        ...orgFilter,
        ...svcFilter,
        origin: "QUOTATION",
        createdAt: { gte: period.gte, lt: period.lt },
      },
      select: {
        branchId: true,
        organizationId: true,
        serviceTypes: true,
        createdAt: true,
        quotedTotal: true,
        organization: { select: { name: true } },
      },
    }),
  ]);

  const quotedOf = (q: (typeof quotations)[number]) =>
    q.versions.find((v) => v.versionNumber === q.currentVersionNumber)?.totalAmount ?? 0;

  // --- by month (primary table + chart) ---
  const months = monthBuckets(period.gte, period.lt);
  const monthRows = months.map((mb) => ({ month: mb.label, key: mb.key, quoted: 0, converted: 0 }));
  const monthByKey = new Map(monthRows.map((r) => [r.key, r]));
  for (const q of quotations) {
    const r = monthByKey.get(bucketKeyForDate(q.createdAt));
    if (r) r.quoted += quotedOf(q);
  }
  for (const j of jobs) {
    const r = monthByKey.get(bucketKeyForDate(j.createdAt));
    if (r) r.converted += j.quotedTotal ?? 0;
  }

  const totalQuoted = quotations.reduce((s, q) => s + quotedOf(q), 0);
  const totalConverted = jobs.reduce((s, j) => s + (j.quotedTotal ?? 0), 0);

  const table: ReportTable = {
    columns: [
      { key: "month", header: "Month" },
      { key: "quoted", header: "Quoted", numeric: true, money: true },
      { key: "converted", header: "Converted", numeric: true, money: true },
    ],
    rows: monthRows.map(({ month, quoted, converted }) => ({ month, quoted, converted })),
    total: { month: "Total", quoted: totalQuoted, converted: totalConverted },
  };

  // --- by branch ---
  const branchAgg = new Map(branches.map((b) => [b.id, { branch: b.name, quoted: 0, converted: 0 }]));
  for (const q of quotations) {
    const row = branchAgg.get(q.branchId);
    if (row) row.quoted += quotedOf(q);
  }
  for (const j of jobs) {
    const row = branchAgg.get(j.branchId);
    if (row) row.converted += j.quotedTotal ?? 0;
  }
  const byBranch: ReportTable = {
    columns: [
      { key: "branch", header: "Branch" },
      { key: "quoted", header: "Quoted", numeric: true, money: true },
      { key: "converted", header: "Converted", numeric: true, money: true },
    ],
    rows: [...branchAgg.values()],
    total: { branch: "Total", quoted: totalQuoted, converted: totalConverted },
  };

  // --- by customer (converted, top 15) ---
  const custAgg = new Map<string, { customer: string; converted: number }>();
  for (const j of jobs) {
    const cur = custAgg.get(j.organizationId) ?? { customer: j.organization.name, converted: 0 };
    cur.converted += j.quotedTotal ?? 0;
    custAgg.set(j.organizationId, cur);
  }
  const byCustomer: ReportTable = {
    columns: [
      { key: "customer", header: "Customer" },
      { key: "converted", header: "Converted revenue", numeric: true, money: true },
    ],
    rows: [...custAgg.values()].sort((a, b) => b.converted - a.converted).slice(0, 15),
  };

  // --- by service type (converted; a multi-service job counts toward each) ---
  const svcAgg = new Map<string, number>();
  for (const j of jobs) {
    for (const s of j.serviceTypes.length ? j.serviceTypes : ["(none)"]) {
      svcAgg.set(s, (svcAgg.get(s) ?? 0) + (j.quotedTotal ?? 0));
    }
  }
  const byServiceType: ReportTable = {
    columns: [
      { key: "serviceType", header: "Service type" },
      { key: "converted", header: "Converted revenue", numeric: true, money: true },
    ],
    rows: [...svcAgg.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, v]) => ({ serviceType: SERVICE_LABELS[s] ?? s, converted: v })),
  };

  return {
    table,
    extraTables: [
      { title: "By branch", table: byBranch },
      { title: "By customer (top 15, converted)", table: byCustomer },
      { title: "By service type (converted)", table: byServiceType },
    ],
    chart: {
      kind: "bar",
      xKey: "month",
      data: monthRows.map((r) => ({ month: r.month, quoted: r.quoted, converted: r.converted })),
      series: [
        { key: "quoted", label: "Quoted", color: "var(--chart-2)" },
        { key: "converted", label: "Converted", color: "var(--chart-1)" },
      ],
    },
    note: "Quoted = current quotation version total. Converted = job value at conversion. Amounts are not currency-converted.",
  };
}
