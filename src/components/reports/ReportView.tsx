import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { ReportChart } from "./ReportChart";
import { ReportTable } from "./ReportTable";
import type { ReportResult } from "@/lib/reports/types";

const inputCls =
  "rounded-md border border-border-subtle bg-background px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-teal";

interface ReportViewProps {
  title: string;
  description: string;
  result: ReportResult;
  periodLabel: string;
  /** current filter values, echoed back into the form */
  filters: { period: string; from: string; to: string; branchId: string };
  /** in-scope branches for the ADMIN branch filter; null hides the control */
  branches: { id: string; name: string }[] | null;
  /** href for the CSV download (already includes the query string) */
  csvHref: string;
  /** pending-ageing is a live snapshot — the period filter does not apply */
  liveSnapshot?: boolean;
}

export function ReportView({
  title,
  description,
  result,
  periodLabel,
  filters,
  branches,
  csvHref,
  liveSnapshot,
}: ReportViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <form method="GET" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Period
              <select name="period" defaultValue={filters.period} className={inputCls} disabled={liveSnapshot}>
                <option value="YTD">Year to date</option>
                <option value="MTD">Month to date</option>
                <option value="WTD">Week to date</option>
                <option value="CUSTOM">Custom range</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              From
              <input type="date" name="from" defaultValue={filters.from} className={inputCls} disabled={liveSnapshot} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              To
              <input type="date" name="to" defaultValue={filters.to} className={inputCls} disabled={liveSnapshot} />
            </label>
            {branches ? (
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                Branch
                <select name="branchId" defaultValue={filters.branchId} className={inputCls}>
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="submit"
              className="rounded-md bg-brand-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-teal/90"
            >
              Apply
            </button>
          </form>
          <a
            href={csvHref}
            className="ml-auto rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
          >
            Download CSV
          </a>
        </CardContent>
      </Card>

      <p className="text-xs text-text-tertiary">
        {liveSnapshot ? "Live snapshot — the period filter does not apply." : `Showing: ${periodLabel}`}
      </p>

      {result.chart ? (
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportChart chart={result.chart} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <ReportTable table={result.table} />
          {result.note ? <p className="mt-3 text-xs text-text-tertiary">{result.note}</p> : null}
        </CardContent>
      </Card>

      {result.extraTables?.map((et) => (
        <Card key={et.title}>
          <CardHeader>
            <CardTitle>{et.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable table={et.table} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
