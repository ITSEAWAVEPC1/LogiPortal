"use client";

import { useCallback, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui";
import { CustomerFormModal } from "@/components/shared/CustomerFormModal";

export interface CustomerOption {
  id: string;
  name: string;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface CustomerComboboxProps {
  value: string;
  displayValue: string;
  branches: Branch[];
  onSelect: (org: CustomerOption) => void;
}

// Wraps the generic Combobox primitive around Stage 1's existing, unchanged
// GET /api/customers?q= search endpoint, and offers inline "+ Create new
// customer" (Section 5.1: no approval gate, immediately selectable) by
// reusing the shared CustomerFormModal — no duplicated create/validation logic.
// Promoted from enquiries/_components to shared/ in Stage 3 so Quotations'
// "bundle enquiries by customer" picker can reuse it unchanged too.
export function CustomerCombobox({ value, displayValue, branches, onSelect }: CustomerComboboxProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const fetchOptions = useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&status=active`);
    if (!res.ok) return [];
    const body = await res.json();
    const organizations = body.organizations as CustomerOption[];
    return organizations.map((org) => ({
      value: org.id,
      label: org.name,
      description: org.contactPersonName ?? undefined,
      data: org,
    }));
  }, []);

  return (
    <>
      <Combobox
        label="Customer"
        value={value}
        displayValue={displayValue}
        placeholder="Search customers..."
        fetchOptions={fetchOptions}
        onChange={(_id, option) => {
          if (!option) return;
          onSelect(option.data as CustomerOption);
        }}
        footer={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-brand-teal hover:bg-background"
          >
            + Create new customer
          </button>
        }
      />
      <CustomerFormModal
        open={createOpen}
        branches={branches}
        onClose={() => setCreateOpen(false)}
        onSaved={(org) => {
          setCreateOpen(false);
          onSelect({
            id: org.id,
            name: org.name,
            contactPersonName: org.contactPersonName,
            contactPersonPhone: org.contactPersonPhone,
            contactPersonEmail: org.contactPersonEmail,
          });
        }}
      />
    </>
  );
}
