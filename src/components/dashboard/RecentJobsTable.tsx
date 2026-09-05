import Link from "next/link";
import { Badge } from "@/components/shadcn/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { MobileRowCard } from "@/components/ui/MobileRowCard";
import { money, shortDate, statusLabel } from "@/components/portal/portal-format";
import { cn } from "@/lib/utils/cn";
import type { RecentJobRow } from "@/lib/dashboard/queries";

// Brand status rule (plan §2.1): teal = completed / positive, plum = active /
// in-progress, amber = needs action, red = exception, gray = pending.
function statusClasses(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-status-success-bg text-status-success-fg";
    case "WORKFLOW_IN_PROGRESS":
      return "bg-brand-plum/10 text-brand-plum";
    case "PENDING_REVIEW":
    case "NEEDS_CORRECTION":
      return "bg-status-warning-bg text-status-warning-fg";
    case "CANCELLED":
      return "bg-status-danger-bg text-status-danger-fg";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function RecentJobsTable({ rows }: { rows: RecentJobRow[] }) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-sm text-text-secondary">No jobs yet.</p>;
  }

  return (
    <>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/jobs/${r.id}`} className="text-brand-teal hover:underline">
                    {r.reference}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{r.organizationName}</TableCell>
                <TableCell>{r.branchName}</TableCell>
                <TableCell>{statusLabel(r.shipmentType)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("border-transparent", statusClasses(r.status))}>
                    {statusLabel(r.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(r.quotedTotal, r.chargesCurrency ?? "INR")}
                </TableCell>
                <TableCell className="text-right text-text-secondary">{shortDate(r.updatedAt.toISOString())}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map((r) => (
          <MobileRowCard
            key={r.id}
            title={
              <Link href={`/jobs/${r.id}`} className="text-brand-teal hover:underline">
                {r.reference}
              </Link>
            }
            rows={[
              { label: "Customer", value: r.organizationName },
              { label: "Branch", value: r.branchName },
              { label: "Type", value: statusLabel(r.shipmentType) },
              {
                label: "Status",
                value: (
                  <Badge variant="outline" className={cn("border-transparent", statusClasses(r.status))}>
                    {statusLabel(r.status)}
                  </Badge>
                ),
              },
              { label: "Value", value: money(r.quotedTotal, r.chargesCurrency ?? "INR") },
              { label: "Updated", value: shortDate(r.updatedAt.toISOString()) },
            ]}
          />
        ))}
      </div>
    </>
  );
}
