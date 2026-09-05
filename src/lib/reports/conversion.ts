import { prisma } from "@/lib/db/prisma";
import {
  enquiryScopeWhere,
  quotationScopeWhere,
  type Scope,
} from "@/lib/permissions/scope";
import { bucketKeyForDate, monthBuckets } from "./period";
import { branchWhere, resolveReportBranchIds } from "./common";
import type { ReportFilters, ReportResult } from "./types";

// Enquiry → quotation → job funnel and quotation win-rate over time, for the
// period. Enquiry stages are bounded by enquiry.createdAt, quotation stages by
// quotation.createdAt (the platform keeps no status-transition history, so
// "reached stage X" is read from current status + the presence of downstream
// records — an approximation, noted on the page).
export async function conversionReport(scope: Scope, filters: ReportFilters): Promise<ReportResult> {
  const { period } = filters;
  const branchIds = resolveReportBranchIds(scope, filters.branchId);
  const bWhere = branchWhere(branchIds);

  const [enquiries, quotations] = await Promise.all([
    prisma.enquiry.findMany({
      where: {
        ...enquiryScopeWhere(scope),
        ...bWhere,
        createdAt: { gte: period.gte, lt: period.lt },
      },
      select: { status: true, quotationEnquiry: { select: { id: true } } },
    }),
    prisma.quotation.findMany({
      where: {
        ...quotationScopeWhere(scope),
        ...bWhere,
        createdAt: { gte: period.gte, lt: period.lt },
      },
      select: {
        status: true,
        createdAt: true,
        sentAt: true,
        customerApproved: true,
        convertedAt: true,
      },
    }),
  ]);

  const enquiriesCreated = enquiries.length;
  const enquiriesQuoted = enquiries.filter(
    (e) => e.status === "READY_FOR_QUOTATION" || e.quotationEnquiry !== null,
  ).length;

  // Stage 14b — the pipeline has no SENT/CUSTOMER_APPROVED step; a quote
  // reaching QUOTATION_PREPARED is the "a quotation exists and the customer
  // can see it" milestone, and APPROVED is the internal sign-off. Legacy
  // statuses (+ sentAt/customerApproved flags) still count for pre-14b rows.
  const PRODUCED = new Set(["QUOTATION_PREPARED", "APPROVED", "SENT", "CUSTOMER_APPROVED", "CONVERTED"]);
  const APPROVED = new Set(["APPROVED", "SENT", "CUSTOMER_APPROVED", "CONVERTED"]);
  const isProduced = (q: (typeof quotations)[number]) => q.sentAt !== null || PRODUCED.has(q.status);
  const isApproved = (q: (typeof quotations)[number]) => q.customerApproved || APPROVED.has(q.status);
  const isConverted = (q: (typeof quotations)[number]) => q.convertedAt !== null || q.status === "CONVERTED";

  const quotationsProduced = quotations.filter(isProduced).length;
  const quotationsApproved = quotations.filter(isApproved).length;
  const quotationsConverted = quotations.filter(isConverted).length;

  const rate = (num: number, den: number) => (den === 0 ? "—" : `${((num / den) * 100).toFixed(1)}%`);

  const funnel = [
    { stage: "Enquiries created", count: enquiriesCreated, fromPrev: "—" },
    { stage: "Ready for quotation", count: enquiriesQuoted, fromPrev: rate(enquiriesQuoted, enquiriesCreated) },
    { stage: "Quotations prepared", count: quotationsProduced, fromPrev: rate(quotationsProduced, enquiriesQuoted) },
    {
      stage: "Approved",
      count: quotationsApproved,
      fromPrev: rate(quotationsApproved, quotationsProduced),
    },
    { stage: "Converted to job", count: quotationsConverted, fromPrev: rate(quotationsConverted, quotationsApproved) },
  ];

  // --- win rate by month (converted / sent, by quotation.createdAt) ---
  const months = monthBuckets(period.gte, period.lt);
  const mrows = months.map((mb) => ({ month: mb.label, key: mb.key, sent: 0, converted: 0 }));
  const mByKey = new Map(mrows.map((r) => [r.key, r]));
  for (const q of quotations) {
    const r = mByKey.get(bucketKeyForDate(q.createdAt));
    if (!r) continue;
    if (isProduced(q)) r.sent += 1;
    if (isConverted(q)) r.converted += 1;
  }

  return {
    table: {
      columns: [
        { key: "stage", header: "Stage" },
        { key: "count", header: "Count", numeric: true },
        { key: "fromPrev", header: "From previous", numeric: true },
      ],
      rows: funnel,
      total: {
        stage: "Overall win rate",
        count: quotationsConverted,
        fromPrev: rate(quotationsConverted, quotationsProduced),
      },
    },
    chart: {
      kind: "bar",
      xKey: "month",
      data: mrows.map((r) => ({
        month: r.month,
        winRate: r.sent === 0 ? 0 : Math.round((r.converted / r.sent) * 1000) / 10,
      })),
      series: [{ key: "winRate", label: "Win rate %", color: "var(--chart-1)" }],
    },
    note: "Win rate = converted ÷ prepared quotations, by quotation month.",
  };
}
