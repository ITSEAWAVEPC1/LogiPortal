import { Badge, DataTable } from "@/components/ui";

interface BatchRow {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  importedRows: number;
  invalidRows: number;
  createdAt: Date;
  uploadedBy: { name: string };
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  COMPLETED: "success",
  PROCESSING: "warning",
  PENDING: "neutral",
  FAILED: "danger",
};

export function BatchHistoryTable({ batches }: { batches: BatchRow[] }) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Import history</h2>
      <DataTable
        columns={[
          { key: "fileName", header: "File" },
          { key: "uploadedBy", header: "Uploaded by", render: (r) => r.uploadedBy.name },
          {
            key: "status",
            header: "Status",
            render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>{r.status}</Badge>,
          },
          { key: "totalRows", header: "Total" },
          { key: "importedRows", header: "Imported" },
          { key: "invalidRows", header: "Flagged" },
          {
            key: "errors",
            header: "",
            render: (r) =>
              r.invalidRows > 0 ? (
                <a href={`/api/data-import/${r.id}/errors`} className="text-sm font-medium text-brand-teal hover:underline">
                  Download errors
                </a>
              ) : null,
          },
          { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        data={batches}
        getRowKey={(r) => r.id}
        emptyMessage="No import runs yet."
      />
    </div>
  );
}
