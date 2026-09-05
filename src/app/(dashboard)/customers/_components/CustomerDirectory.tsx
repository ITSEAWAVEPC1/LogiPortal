"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, ColumnPicker, DataTable, Input, Select, type ColumnDef } from "@/components/ui";
import type { Role } from "@/lib/permissions/roles";
import { can } from "@/lib/permissions/capabilities";

interface OrganizationRow {
  id: string;
  name: string;
  alias: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  city: string | null;
  state: string | null;
  branchId: string | null;
  isActive: boolean;
  isShipper: boolean;
  isConsignee: boolean;
  isAgent: boolean;
  isCarrier: boolean;
  isService: boolean;
  isGlobal: boolean;
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

const COLUMN_DEFS: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "alias", label: "Alias" },
  { key: "entityType", label: "Entity Type" },
  { key: "contact", label: "Contact" },
  { key: "gst", label: "GST" },
  { key: "pan", label: "PAN" },
  { key: "branch", label: "Branch" },
  { key: "status", label: "Status" },
];

const DEFAULT_COLUMNS = ["name", "alias", "entityType", "contact", "gst", "branch", "status"];
const COLUMN_PREFERENCE_KEY = "customers-list-columns";

function entityTypeLabel(row: OrganizationRow) {
  const roles: string[] = [];
  if (row.isShipper) roles.push("Shipper");
  if (row.isConsignee) roles.push("Consignee");
  if (row.isAgent) roles.push("Agent");
  if (row.isCarrier) roles.push("Carrier");
  if (row.isService) roles.push("Service");
  if (row.isGlobal) roles.push("Global");
  return roles.length > 0 ? roles.join(", ") : "—";
}

export function CustomerDirectory({ organizations, branches, role, initialQuery }: CustomerDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery.q);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canCreate = can(role, "customers", "create");
  const canEdit = can(role, "customers", "edit");
  const canDelete = can(role, "customers", "delete");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/preferences/${COLUMN_PREFERENCE_KEY}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && Array.isArray(body.columns) && body.columns.length > 0) {
          setColumns(body.columns);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function applyColumns(next: string[]) {
    setColumns(next);
    fetch(`/api/preferences/${COLUMN_PREFERENCE_KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: next }),
    }).catch(() => {});
  }

  function updateQuery(next: Partial<{ q: string; branchId: string; status: string }>) {
    const merged = { q, branchId: initialQuery.branchId, status: initialQuery.status, ...next };
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(merged).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  async function toggleActive(org: OrganizationRow) {
    await fetch(`/api/customers/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !org.isActive }),
    });
    router.refresh();
  }

  const allColumnRenderers: Record<string, { header: string; render: (row: OrganizationRow) => ReactNode }> = {
    name: { header: "Name", render: (row) => row.name },
    alias: { header: "Alias", render: (row) => row.alias ?? "—" },
    entityType: { header: "Entity Type", render: entityTypeLabel },
    contact: {
      header: "Contact",
      render: (row) => (
        <div>
          <p>{row.contactPersonName ?? "—"}</p>
          <p className="text-xs text-text-tertiary">{row.contactPersonPhone ?? row.contactPersonEmail ?? ""}</p>
        </div>
      ),
    },
    gst: { header: "GST", render: (row) => row.kycDetail?.gstNumber ?? "—" },
    pan: { header: "PAN", render: (row) => row.kycDetail?.panNumber ?? "—" },
    branch: { header: "Branch", render: (row) => row.branch?.name ?? "—" },
    status: {
      header: "Status",
      render: (row) => <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
    },
  };

  const dataColumns = columns
    .filter((key) => allColumnRenderers[key])
    .map((key) => ({ key, header: allColumnRenderers[key].header, render: allColumnRenderers[key].render }));

  dataColumns.push({
    key: "actions",
    header: "",
    render: (row: OrganizationRow) => (
      <div className="flex gap-2">
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => router.push(`/customers/${row.id}`)}>
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
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Customers</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            Customize Columns
          </Button>
          {canCreate && <Button onClick={() => router.push("/customers/new")}>New Customer</Button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search name, alias, contact, GST..."
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

      <DataTable columns={dataColumns} data={organizations} getRowKey={(row) => row.id} emptyMessage="No customers found." />

      <ColumnPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        columns={COLUMN_DEFS}
        selected={columns}
        defaultSelected={DEFAULT_COLUMNS}
        onApply={applyColumns}
      />
    </div>
  );
}
