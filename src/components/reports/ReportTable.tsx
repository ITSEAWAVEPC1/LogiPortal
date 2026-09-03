import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { cn } from "@/lib/utils/cn";
import type { ReportTable as ReportTableType } from "@/lib/reports/types";
import { formatReportCell } from "./report-format";

export function ReportTable({ table }: { table: ReportTableType }) {
  if (table.rows.length === 0) {
    return <p className="px-1 py-6 text-sm text-text-secondary">No data for this period.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {table.columns.map((c) => (
            <TableHead key={c.key} className={cn((c.numeric || c.money) && "text-right")}>
              {c.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.map((row, i) => (
          <TableRow key={i}>
            {table.columns.map((c) => (
              <TableCell
                key={c.key}
                className={cn((c.numeric || c.money) && "text-right tabular-nums")}
              >
                {formatReportCell(row[c.key], c)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {table.total ? (
        <TableFooter>
          <TableRow>
            {table.columns.map((c) => (
              <TableCell
                key={c.key}
                className={cn("font-semibold", (c.numeric || c.money) && "text-right tabular-nums")}
              >
                {formatReportCell(table.total?.[c.key], c)}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}
