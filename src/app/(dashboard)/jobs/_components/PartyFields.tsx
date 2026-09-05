"use client";

import { Input, Textarea } from "@/components/ui";

export interface PartyState {
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
}

export const EMPTY_PARTY: PartyState = { name: "", address: "", contactPerson: "", phone: "", email: "" };

export function partyFromRaw(raw: {
  name: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
} | null): PartyState {
  if (!raw) return { ...EMPTY_PARTY };
  return {
    name: raw.name ?? "",
    address: raw.address ?? "",
    contactPerson: raw.contactPerson ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
  };
}

interface PartyFieldsProps {
  title: string;
  value: PartyState;
  onChange: (value: PartyState) => void;
  disabled?: boolean;
}

export function PartyFields({ title, value, onChange, disabled }: PartyFieldsProps) {
  function set<K extends keyof PartyState>(key: K, v: PartyState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="Name" value={value.name} onChange={(e) => set("name", e.target.value)} disabled={disabled} />
        <Input
          label="Contact Person"
          value={value.contactPerson}
          onChange={(e) => set("contactPerson", e.target.value)}
          disabled={disabled}
        />
        <Input label="Phone" value={value.phone} onChange={(e) => set("phone", e.target.value)} disabled={disabled} />
        <Input
          label="Email"
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="mt-3">
        <Textarea
          label="Address"
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
          rows={2}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
