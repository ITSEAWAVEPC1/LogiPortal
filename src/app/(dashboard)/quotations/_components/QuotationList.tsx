"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, DataTable, Input, Select } from "@/components/ui";
import { formatQuotationRef } from "@/lib/validation/quotation";
import { ReviewModal } from "./ReviewModal";

type QuotationStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "NEEDS_CORRECTION"
  | "APPROVED"
  | "SENT"
  | "CUSTOMER_APPROVED"
  | "CONVERTED";

interface QuotationRow {
  id: string;
  sequenceNumber: number;
  status: QuotationStatus;
  createdAt: string | Date;
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  createdBy: { id: string; name: string };
  _count: { enquiries: number };
  versions: { totalAmount: number; currency: string }[];
}

interface Branch {
  id: string;
  name: string;
}

interface QuotationListProps {
  quotations: QuotationRow[];
  branches: Branch[];
  initialQuery: { status: string; branchId: string; q: string };
  canCreate: boolean;
  canApprove: boolean;
}

const STATUS_TABS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "NEEDS_CORRECTION", label: "Needs Correction" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT", label: "Sent" },
  { value: "CUSTOMER_APPROVED", label: "Customer Approved" },
  { value: "CONVERTED", label: "Converted" },
];

const STATUS_BADGE_VARIANT: Record<QuotationStatus, "pending" | "active" | "danger" | "success" | "neutral"> = {
  DRAFT: "pending",
  PENDING_APPROVAL: "active",
  NEEDS_CORRECTION: "danger",
  APPROVED: "success",
  SENT: "success",
  CUSTOMER_APPROVED: "success",
  CONVERTED: "neutral",
};

export function QuotationList({ quotations, branches, initialQuery, canCreate, canApprove }: QuotationListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery.q);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function updateQuery(next: Partial<{ status: string; branchId: string; q: string }>) {
    const merged = { ...initialQuery, q, ...next };
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(merged).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function handleApprove(id: string) {
    setActionError(null);
    const res = await fetch(`/api/quotations/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Approve failed");
      return;
    }
    router.refresh();
  }

  async function handleFlagBack(note: string) {
    if (!reviewTarget) return;
    const res = await fetch(`/api/quotations/${reviewTarget}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "needs_correction", note }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Flag back failed");
    }
    setReviewTarget(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Quotations</h1>
        {canCreate && (
          <Link href="/quotations/new">
            <Button>New Quotation</Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border-subtle">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => updateQuery({ status: tab.value })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              initialQuery.status === tab.value
                ? "border-brand-teal text-brand-teal"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search customer..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && updateQuery({ q })}
          onBlur={() => updateQuery({ q })}
          className="w-72"
        />
        <Select
          value={initialQuery.branchId}
          onChange={(e) => updateQuery({ branchId: e.target.value })}
          placeholder="All branches"
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
          className="w-48"
        />
      </div>

      {actionError && <p className="mb-3 text-sm text-status-danger-fg">{actionError}</p>}

      <DataTable
        columns={[
          {
            key: "ref",
            header: "Reference",
            render: (row) => (
              <Link href={`/quotations/${row.id}`} className="font-medium text-brand-teal hover:underline">
                {formatQuotationRef(row.createdAt, row.sequenceNumber)}
              </Link>
            ),
          },
          { key: "customer", header: "Customer", render: (row) => row.organization.name },
          { key: "branch", header: "Branch", render: (row) => row.branch.name },
          { key: "enquiries", header: "Enquiries", render: (row) => row._count.enquiries },
          {
            key: "total",
            header: "Total",
            render: (row) =>
              row.versions[0] ? `${row.versions[0].currency} ${row.versions[0].totalAmount.toFixed(2)}` : "—",
          },
          { key: "createdBy", header: "Created By", render: (row) => row.createdBy.name },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.status.replace(/_/g, " ")}</Badge>,
          },
          { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString() },
          {
            key: "actions",
            header: "",
            render: (row) =>
              canApprove && row.status === "PENDING_APPROVAL" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setReviewTarget(row.id)}>
                    Flag Back
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(row.id)}>
                    Approve
                  </Button>
                </div>
              ) : null,
          },
        ]}
        data={quotations}
        getRowKey={(row) => row.id}
        emptyMessage="No quotations found."
      />

      <ReviewModal open={reviewTarget !== null} onClose={() => setReviewTarget(null)} onSubmit={handleFlagBack} />
    </div>
  );
}
