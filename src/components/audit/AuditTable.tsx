import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";

export interface AuditColumn {
  key: string;
  header: string;
  mono?: boolean;
  wide?: boolean;
}

export function AuditTable({
  columns,
  rows,
}: {
  columns: AuditColumn[];
  rows: Array<Record<string, string>>;
}) {
  if (rows.length === 0) {
    return <p className="px-1 py-8 text-sm text-text-secondary">No entries match these filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  className={[
                    c.mono ? "font-mono text-xs" : "",
                    c.wide ? "" : "whitespace-nowrap",
                  ].join(" ")}
                >
                  {row[c.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
