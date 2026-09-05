"use client";

import { Checkbox, Input, Select } from "@/components/ui";
import type { OrganizationFormState } from "./types";

interface Branch {
  id: string;
  name: string;
}

interface GeneralSectionProps {
  form: OrganizationFormState;
  onChange: (patch: Partial<OrganizationFormState>) => void;
  branches: Branch[];
  canEdit: boolean;
}

export function GeneralSection({ form, onChange, branches, canEdit }: GeneralSectionProps) {
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="Name" required value={form.name} onChange={(e) => onChange({ name: e.target.value })} />
        <Input label="Alias" value={form.alias} onChange={(e) => onChange({ alias: e.target.value })} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-border-subtle p-3">
        <Checkbox label="Shipper" checked={form.isShipper} onChange={(e) => onChange({ isShipper: e.target.checked })} />
        <Checkbox
          label="Consignee"
          checked={form.isConsignee}
          onChange={(e) => onChange({ isConsignee: e.target.checked })}
        />
        <Checkbox label="Agent" checked={form.isAgent} onChange={(e) => onChange({ isAgent: e.target.checked })} />
        <Checkbox label="Carrier" checked={form.isCarrier} onChange={(e) => onChange({ isCarrier: e.target.checked })} />
        <Checkbox label="Services" checked={form.isService} onChange={(e) => onChange({ isService: e.target.checked })} />
        <Checkbox label="Global" checked={form.isGlobal} onChange={(e) => onChange({ isGlobal: e.target.checked })} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input
          label="Contact person"
          value={form.contactPersonName}
          onChange={(e) => onChange({ contactPersonName: e.target.value })}
        />
        <Input
          label="Phone"
          value={form.contactPersonPhone}
          onChange={(e) => onChange({ contactPersonPhone: e.target.value })}
        />
      </div>
      <Input
        label="Email"
        type="email"
        value={form.contactPersonEmail}
        onChange={(e) => onChange({ contactPersonEmail: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="City" value={form.city} onChange={(e) => onChange({ city: e.target.value })} />
        <Input label="State" value={form.state} onChange={(e) => onChange({ state: e.target.value })} />
      </div>
      <Select
        label="Home Branch"
        placeholder="Unassigned"
        value={form.branchId}
        onChange={(e) => onChange({ branchId: e.target.value })}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">KYC</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Input
            label="GST number"
            value={form.gstNumber}
            onChange={(e) => onChange({ gstNumber: e.target.value.toUpperCase() })}
          />
          <Input
            label="PAN number"
            value={form.panNumber}
            onChange={(e) => onChange({ panNumber: e.target.value.toUpperCase() })}
          />
          <Input
            label="TAN number"
            value={form.tanNumber}
            onChange={(e) => onChange({ tanNumber: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
    </fieldset>
  );
}
