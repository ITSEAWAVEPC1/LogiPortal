"use client";

import { FormEvent, useState } from "react";
import { Button, Input, Modal, Select } from "@/components/ui";

interface OrganizationRow {
  id: string;
  name: string;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  city: string | null;
  state: string | null;
  branchId: string | null;
  kycDetail: { gstNumber: string | null; panNumber: string | null; tanNumber: string | null } | null;
}

interface Branch {
  id: string;
  name: string;
}

interface CustomerFormModalProps {
  open: boolean;
  organization?: OrganizationRow;
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: "",
  contactPersonName: "",
  contactPersonPhone: "",
  contactPersonEmail: "",
  city: "",
  state: "",
  branchId: "",
  gstNumber: "",
  panNumber: "",
  tanNumber: "",
};

function formFromOrganization(organization?: OrganizationRow) {
  if (!organization) return EMPTY_FORM;
  return {
    name: organization.name,
    contactPersonName: organization.contactPersonName ?? "",
    contactPersonPhone: organization.contactPersonPhone ?? "",
    contactPersonEmail: organization.contactPersonEmail ?? "",
    city: organization.city ?? "",
    state: organization.state ?? "",
    branchId: organization.branchId ?? "",
    gstNumber: organization.kycDetail?.gstNumber ?? "",
    panNumber: organization.kycDetail?.panNumber ?? "",
    tanNumber: organization.kycDetail?.tanNumber ?? "",
  };
}

export function CustomerFormModal({ open, organization, branches, onClose, onSaved }: CustomerFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={organization ? "Edit Customer" : "New Customer"}>
      {/* Keyed by identity so the form's state re-initializes on remount
          instead of via a setState-in-effect reset (avoids cascading renders). */}
      {open && (
        <CustomerForm
          key={organization?.id ?? "new"}
          organization={organization}
          branches={branches}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function CustomerForm({
  organization,
  branches,
  onClose,
  onSaved,
}: {
  organization?: OrganizationRow;
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => formFromOrganization(organization));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = organization ? `/api/customers/${organization.id}` : "/api/customers";
    const method = organization ? "PATCH" : "POST";
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

    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Customer name"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Contact person"
          value={form.contactPersonName}
          onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })}
        />
        <Input
          label="Phone"
          value={form.contactPersonPhone}
          onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })}
        />
      </div>
      <Input
        label="Email"
        type="email"
        value={form.contactPersonEmail}
        onChange={(e) => setForm({ ...form, contactPersonEmail: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
      </div>
      <Select
        label="Branch"
        placeholder="Unassigned"
        value={form.branchId}
        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="GST number"
          value={form.gstNumber}
          onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })}
        />
        <Input
          label="PAN number"
          value={form.panNumber}
          onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
        />
        <Input
          label="TAN number"
          value={form.tanNumber}
          onChange={(e) => setForm({ ...form, tanNumber: e.target.value.toUpperCase() })}
        />
      </div>
      {error && <p className="text-sm text-status-danger-fg">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
