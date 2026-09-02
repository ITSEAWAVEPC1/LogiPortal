"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, DataTable, Input, Select } from "@/components/ui";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { ReviewModal } from "./ReviewModal";

interface EnquiryRow {
  id: string;
  sequenceNumber: number;
  referenceNo: string | null;
  status: "DRAFT" | "OPEN" | "READY_FOR_QUOTATION" | "NEEDS_CORRECTION";
  createdAt: string | Date;
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  doer: { id: string; name: string };
}

interface Branch {
  id: string;
  name: string;
}

interface EnquiryListProps {
  enquiries: EnquiryRow[];
  branches: Branch[];
  initialQuery: { status: string; branchId: string; q: string };
  canCreate: boolean;
  canApprove: boolean;
}

const STATUS_TABS = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "READY_FOR_QUOTATION", label: "Ready for Quotation" },
  { value: "NEEDS_CORRECTION", label: "Needs Correction" },
];

const STATUS_BADGE_VARIANT = {
  DRAFT: "pending",
  OPEN: "active",
  READY_FOR_QUOTATION: "success",
  NEEDS_CORRECTION: "danger",
} as const;

export function EnquiryList({ enquiries, branches, initialQuery, canCreate, canApprove }: EnquiryListProps) {
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
    const res = await fetch(`/api/enquiries/${id}/review`, {
      method: "PATCH",
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
    const res = await fetch(`/api/enquiries/${reviewTarget}/review`, {
      method: "PATCH",
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
        <h1 className="text-2xl font-semibold text-text-primary">Enquiries</h1>
        {canCreate && (
          <Link href="/enquiries/new">
            <Button>New Enquiry</Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex gap-2 border-b border-border-subtle">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => updateQuery({ status: tab.value })}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
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
          placeholder="Search customer, contact..."
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
              <Link href={`/enquiries/${row.id}`} className="font-medium text-brand-teal hover:underline">
                {formatEnquiryRef(row)}
              </Link>
            ),
          },
          { key: "customer", header: "Customer", render: (row) => row.organization.name },
          { key: "branch", header: "Branch", render: (row) => row.branch.name },
          { key: "doer", header: "Doer", render: (row) => row.doer.name },
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
              canApprove && row.status === "OPEN" ? (
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
        data={enquiries}
        getRowKey={(row) => row.id}
        emptyMessage="No enquiries found."
      />

      <ReviewModal open={reviewTarget !== null} onClose={() => setReviewTarget(null)} onSubmit={handleFlagBack} />
    </div>
  );
}
