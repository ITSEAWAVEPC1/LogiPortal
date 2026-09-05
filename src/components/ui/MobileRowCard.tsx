import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface MobileRowCardRow {
  label: string;
  value: ReactNode;
}

interface MobileRowCardProps {
  title: ReactNode;
  rows: MobileRowCardRow[];
  /** Visually distinguishes a summary/total card, e.g. a report's footer row. */
  emphasized?: boolean;
}

// Stage 13b — the mobile fallback for wide tables: one card per row, label:value
// pairs instead of columns. Shared by DataTable, RecentJobsTable, and ReportTable.
export function MobileRowCard({ title, rows, emphasized }: MobileRowCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface p-3",
        emphasized && "bg-background",
      )}
    >
      <p className="mb-2 text-sm font-semibold text-text-primary">{title}</p>
      <dl className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="text-right text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
