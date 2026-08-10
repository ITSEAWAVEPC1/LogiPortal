"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, DataTable, Input, Modal, Select } from "@/components/ui";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions/roles";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  branch: { id: string; name: string } | null;
}

interface Branch {
  id: string;
  name: string;
}

interface UserManagerProps {
  users: UserRow[];
  branches: Branch[];
}

const EMPTY_FORM = { name: "", email: "", role: "DOER" as Role, branchId: "", password: "" };

export function UserManager({ users, branches }: UserManagerProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<{ open: boolean; user?: UserRow }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setModalState({ open: true });
  }

  function openEdit(user: UserRow) {
    setForm({ name: user.name, email: user.email, role: user.role, branchId: user.branch?.id ?? "", password: "" });
    setError(null);
    setModalState({ open: true, user });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = modalState.user ? `/api/users/${modalState.user.id}` : "/api/users";
    const method = modalState.user ? "PATCH" : "POST";
    const payload = modalState.user
      ? { name: form.name, role: form.role, branchId: form.branchId, ...(form.password ? { password: form.password } : {}) }
      : form;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async function toggleActive(user: UserRow) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Users</h1>
        <Button onClick={openCreate}>New User</Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "role", header: "Role", render: (row) => ROLE_LABELS[row.role] },
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
        data={users}
        getRowKey={(row) => row.id}
        emptyMessage="No users yet."
      />

      <Modal
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        title={modalState.user ? "Edit User" : "New User"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            disabled={!!modalState.user}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
          <Select
            label="Branch"
            placeholder="Unassigned"
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Input
            label={modalState.user ? "New password (leave blank to keep current)" : "Temporary password"}
            type="password"
            required={!modalState.user}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
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
