"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, DataTable, Input, Select } from "@/components/ui";
import { formatJobRef, JOB_STATUS_OPTIONS } from "@/lib/validation/job";
import { ReviewModal } from "./ReviewModal";

type JobStatus = (typeof JOB_STATUS_OPTIONS)[number]["value"];

interface JobRow {
  id: string;
  sequenceNumber: number;
  referenceNo: string | null;
  status: JobStatus;
  origin: "QUOTATION" | "DIRECT" | "IMPORTED";
  shipmentType: "IMPORT" | "EXPORT";
  createdAt: string | Date;
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  createdBy: { id: string; name: string };
}

interface Branch {
  id: string;
  name: string;
}

interface JobListProps {
  jobs: JobRow[];
  branches: Branch[];
  total: number;
  page: number;
  pageSize: number;
  initialQuery: { status: string; branchId: string; shipmentType: string; q: string };
  canCreate: boolean;
  canApprove: boolean;
  canImport: boolean;
}

const STATUS_TABS = JOB_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

const DIRECTION_TABS = [
  { value: "", label: "All" },
  { value: "IMPORT", label: "Imports" },
  { value: "EXPORT", label: "Exports" },
] as const;

const STATUS_BADGE_VARIANT: Record<JobStatus, "pending" | "active" | "success" | "danger" | "neutral"> = {
  DRAFT: "pending",
  PENDING_REVIEW: "active",
  NEEDS_CORRECTION: "danger",
  WORKFLOW_IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export function JobList({
  jobs,
  branches,
  total,
  page,
  pageSize,
  initialQuery,
  canCreate,
  canApprove,
  canImport,
}: JobListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery.q);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const directionScoped = initialQuery.shipmentType === "IMPORT" || initialQuery.shipmentType === "EXPORT";
  const newJobHref = directionScoped ? `/jobs/new?shipmentType=${initialQuery.shipmentType}` : "/jobs/new";

  function updateQuery(next: Partial<{ status: string; branchId: string; shipmentType: string; q: string; page: string }>) {
    const merged = { ...initialQuery, q, page: "1", ...next };
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(merged).forEach(([key, value]) => {
      if (value && value !== "1") params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function handleApprove(id: string) {
    setActionError(null);
    const res = await fetch(`/api/jobs/${id}/review`, {
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
    const res = await fetch(`/api/jobs/${reviewTarget}/review`, {
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
        <h1 className="text-2xl font-semibold text-text-primary">
          Freight Forwarding
          {initialQuery.shipmentType === "IMPORT" && " — Imports"}
          {initialQuery.shipmentType === "EXPORT" && " — Exports"}
        </h1>
        <div className="flex gap-2">
          {canImport && (
            <Link href="/jobs/import">
              <Button variant="ghost">Import Historical Jobs</Button>
            </Link>
          )}
          {canCreate && (
            <Link href={newJobHref}>
              <Button>New Job</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1">
        {DIRECTION_TABS.map((tab) => (
          <button
            key={tab.value || "ALL"}
            onClick={() => updateQuery({ shipmentType: tab.value })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              initialQuery.shipmentType === tab.value
                ? "bg-brand-teal/10 text-brand-teal"
                : "text-text-secondary hover:bg-background hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-border-subtle">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => updateQuery({ status: tab.value })}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
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
          placeholder="Search customer, vessel, port..."
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
              <Link href={`/jobs/${row.id}`} className="font-medium text-brand-teal hover:underline">
                {formatJobRef(row)}
              </Link>
            ),
          },
          { key: "customer", header: "Customer", render: (row) => row.organization.name },
          { key: "branch", header: "Branch", render: (row) => row.branch.name },
          // Redundant once the list is scoped to one direction.
          ...(directionScoped
            ? []
            : [{ key: "shipmentType", header: "Type", render: (row: JobRow) => row.shipmentType }]),
          { key: "createdBy", header: "Created by", render: (row) => row.createdBy.name },
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
              canApprove && row.status === "PENDING_REVIEW" ? (
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
        data={jobs}
        getRowKey={(row) => row.id}
        emptyMessage="No jobs found."
      />

      <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
        <span>
          {total} job{total === 1 ? "" : "s"} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => updateQuery({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => updateQuery({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      </div>

      <ReviewModal open={reviewTarget !== null} onClose={() => setReviewTarget(null)} onSubmit={handleFlagBack} />
    </div>
  );
}
