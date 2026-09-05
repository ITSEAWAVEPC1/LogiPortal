"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, DataTable, Input, Modal } from "@/components/ui";

interface BranchRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count: { users: number; organizations: number };
}

interface BranchManagerProps {
  branches: BranchRow[];
}

const EMPTY_FORM = { name: "", code: "" };

export function BranchManager({ branches }: BranchManagerProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<{ open: boolean; branch?: BranchRow }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setModalState({ open: true });
  }

  function openEdit(branch: BranchRow) {
    setForm({ name: branch.name, code: branch.code });
    setError(null);
    setModalState({ open: true, branch });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = modalState.branch ? `/api/branches/${modalState.branch.id}` : "/api/branches";
    const method = modalState.branch ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }

    setModalState({ open: false });
    router.refresh();
  }

  async function toggleActive(branch: BranchRow) {
    await fetch(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !branch.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Branches</h1>
        <Button onClick={openCreate}>New Branch</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "code", header: "Code" },
          { key: "users", header: "Users", render: (row) => String(row._count.users) },
          { key: "customers", header: "Customers", render: (row) => String(row._count.organizations) },
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
                <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(row)}>
                  {row.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            ),
          },
        ]}
        data={branches}
        getRowKey={(row) => row.id}
        emptyMessage="No branches yet."
      />

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.branch ? "Edit Branch" : "New Branch"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Branch name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Branch code"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          />
          {error && <p className="text-sm text-status-danger-fg">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalState({ open: false })}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
