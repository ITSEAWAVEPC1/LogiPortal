"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, DataTable, Input, Select } from "@/components/ui";
import { formatEnquiryRef } from "@/lib/validation/enquiry";

interface EnquiryRow {
  id: string;
  sequenceNumber: number;
  referenceNo: string | null;
  status: "DRAFT" | "OPEN" | "READY_FOR_QUOTATION" | "NEEDS_CORRECTION";
  createdAt: string | Date;
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  doer: { id: string; name: string };
  quotationEnquiry: { id: string } | null;
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
  canEdit: boolean;
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

export function EnquiryList({ enquiries, branches, initialQuery, canCreate, canEdit }: EnquiryListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery.q);

  function updateQuery(next: Partial<{ status: string; branchId: string; q: string }>) {
    const merged = { ...initialQuery, q, ...next };
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(merged).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          { key: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleDateString("en-GB") },
          {
            key: "actions",
            header: "",
            render: (row) =>
              canEdit && !row.quotationEnquiry ? (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Edit enquiry"
                  onClick={() => router.push(`/enquiries/${row.id}`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null,
          },
        ]}
        data={enquiries}
        getRowKey={(row) => row.id}
        emptyMessage="No enquiries found."
      />
    </div>
  );
}
