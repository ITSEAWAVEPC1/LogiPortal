"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, DataTable, Input, Select } from "@/components/ui";
import type { Role } from "@/lib/permissions/roles";
import { can } from "@/lib/permissions/capabilities";
import { CustomerFormModal } from "./CustomerFormModal";

interface OrganizationRow {
  id: string;
  name: string;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  city: string | null;
  state: string | null;
  branchId: string | null;
  isActive: boolean;
  branch: { id: string; name: string } | null;
  kycDetail: { gstNumber: string | null; panNumber: string | null; tanNumber: string | null } | null;
}

interface Branch {
  id: string;
  name: string;
}

interface CustomerDirectoryProps {
  organizations: OrganizationRow[];
  branches: Branch[];
  role: Role;
  initialQuery: { q: string; branchId: string; status: string };
}

export function CustomerDirectory({ organizations, branches, role, initialQuery }: CustomerDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery.q);
  const [modalState, setModalState] = useState<{ open: boolean; organization?: OrganizationRow }>({ open: false });

  const canCreate = can(role, "customers", "create");
  const canEdit = can(role, "customers", "edit");
  const canDelete = can(role, "customers", "delete");

  function updateQuery(next: Partial<{ q: string; branchId: string; status: string }>) {
    const merged = { q, branchId: initialQuery.branchId, status: initialQuery.status, ...next };
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(merged).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function toggleActive(org: OrganizationRow) {
    await fetch(`/api/customers/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !org.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Customers</h1>
        {canCreate && <Button onClick={() => setModalState({ open: true })}>New Customer</Button>}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search name, contact, GST..."
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
        <Select
          value={initialQuery.status}
          onChange={(e) => updateQuery({ status: e.target.value })}
          placeholder="All statuses"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          className="w-40"
        />
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          {
            key: "contact",
            header: "Contact",
            render: (row) => (
              <div>
                <p>{row.contactPersonName ?? "—"}</p>
                <p className="text-xs text-text-tertiary">
                  {row.contactPersonPhone ?? row.contactPersonEmail ?? ""}
                </p>
              </div>
            ),
          },
          { key: "gst", header: "GST", render: (row) => row.kycDetail?.gstNumber ?? "—" },
          { key: "branch", header: "Branch", render: (row) => row.branch?.name ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <div className="flex gap-2">
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setModalState({ open: true, organization: row })}>
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(row)}>
                    {row.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        data={organizations}
        getRowKey={(row) => row.id}
        emptyMessage="No customers found."
      />

      <CustomerFormModal
        open={modalState.open}
        organization={modalState.organization}
        branches={branches}
        onClose={() => setModalState({ open: false })}
        onSaved={() => {
          setModalState({ open: false });
          router.refresh();
        }}
      />
    </div>
  );
}
