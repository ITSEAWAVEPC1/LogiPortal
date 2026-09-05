"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, DataTable, Input, Modal } from "@/components/ui";

interface PortRow {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

interface PortManagerProps {
  ports: PortRow[];
}

const EMPTY_FORM = { name: "", code: "" };

export function PortManager({ ports }: PortManagerProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<{ open: boolean; port?: PortRow }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setModalState({ open: true });
  }

  function openEdit(port: PortRow) {
    setForm({ name: port.name, code: port.code ?? "" });
    setError(null);
    setModalState({ open: true, port });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = modalState.port ? `/api/ports/${modalState.port.id}` : "/api/ports";
    const method = modalState.port ? "PATCH" : "POST";
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

  async function toggleActive(port: PortRow) {
    await fetch(`/api/ports/${port.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !port.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Ports</h1>
        <Button onClick={openCreate}>New Port</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "code", header: "Code", render: (row) => row.code ?? "—" },
          {
            key: "status",
            header: "Status",
            render: (row) => <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>,
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
        data={ports}
        getRowKey={(row) => row.id}
        emptyMessage="No ports yet."
      />

      <Modal open={modalState.open} onClose={() => setModalState({ open: false })} title={modalState.port ? "Edit Port" : "New Port"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input
            label="Code"
            placeholder="e.g. INNSA (optional)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
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
