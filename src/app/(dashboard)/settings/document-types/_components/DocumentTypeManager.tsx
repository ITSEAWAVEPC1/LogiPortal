"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Checkbox, DataTable, Input, Modal } from "@/components/ui";

interface DocumentTypeRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  isFinancial: boolean;
  isGeneratable: boolean;
  customerVisibleDefault: boolean;
  isActive: boolean;
}

const EMPTY = { name: "", code: "", customerVisibleDefault: false };

export function DocumentTypeManager({ documentTypes }: { documentTypes: DocumentTypeRow[] }) {
  const router = useRouter();
  const [modal, setModal] = useState<{ open: boolean; row?: DocumentTypeRow }>({ open: false });
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setForm(EMPTY);
    setError(null);
    setModal({ open: true });
  }
  function openEdit(row: DocumentTypeRow) {
    setForm({ name: row.name, code: row.code, customerVisibleDefault: row.customerVisibleDefault });
    setError(null);
    setModal({ open: true, row });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const url = modal.row ? `/api/document-types/${modal.row.id}` : "/api/document-types";
    const method = modal.row ? "PATCH" : "POST";
    const body = modal.row
      ? { name: form.name, customerVisibleDefault: form.customerVisibleDefault }
      : { name: form.name, code: form.code, customerVisibleDefault: form.customerVisibleDefault };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Something went wrong.");
      return;
    }
    setModal({ open: false });
    router.refresh();
  }

  async function toggleActive(row: DocumentTypeRow) {
    await fetch(`/api/document-types/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Document Types</h1>
          <p className="text-sm text-text-secondary">
            The five built-in types (HBL, MBL, Freight Certificate, Delivery Order, Invoice) have PDF templates and cannot
            be added here. New types are upload-only categories (Packing List, Certificate of Origin, …).
          </p>
        </div>
        <Button onClick={openCreate}>New Document Type</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "code", header: "Code" },
          { key: "kind", header: "Kind" },
          {
            key: "flags",
            header: "Flags",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.isGeneratable && <Badge variant="active">Generatable</Badge>}
                {r.isFinancial && <Badge variant="warning">Financial</Badge>}
                {r.customerVisibleDefault && <Badge variant="neutral">Customer default</Badge>}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                  {r.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            ),
          },
        ]}
        data={documentTypes}
        getRowKey={(r) => r.id}
        emptyMessage="No document types."
      />

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.row ? "Edit Document Type" : "New Document Type"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {!modal.row && (
            <Input
              label="Code"
              placeholder="Auto-generated from name if left blank"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          )}
          <Checkbox
            label="Visible to customers by default"
            checked={form.customerVisibleDefault}
            onChange={(e) => setForm({ ...form, customerVisibleDefault: e.target.checked })}
          />
          {error && <p className="text-sm text-status-danger-fg">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModal({ open: false })}>
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
