import { ReactNode } from "react";
import { MobileRowCard } from "./MobileRowCard";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Marks this column as the mobile card's heading. Defaults to the first column. */
  isRowTitle?: boolean;
  /** Omits this column from the mobile card (still shown in the desktop table). */
  mobileHidden?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}

function cellValue<T>(col: Column<T>, row: T): ReactNode {
  return col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "");
}

export function DataTable<T>({ columns, data, getRowKey, emptyMessage = "No records." }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="min-w-full divide-y divide-border-subtle text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-surface">
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const titleColumn = columns.find((c) => c.isRowTitle) ?? columns[0];
  const cardColumns = columns.filter((c) => c !== titleColumn && !c.mobileHidden);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border-subtle lg:block">
        <table className="min-w-full divide-y divide-border-subtle text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-surface">
            {data.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-background/50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-text-primary">
                    {cellValue(col, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        {data.map((row) => (
          <MobileRowCard
            key={getRowKey(row)}
            title={cellValue(titleColumn, row)}
            rows={cardColumns.map((c) => ({ label: c.header, value: cellValue(c, row) }))}
          />
        ))}
      </div>
    </>
  );
}
