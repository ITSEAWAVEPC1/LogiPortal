"use client";

import { Button, Checkbox, Input, Select } from "@/components/ui";
import { CURRENCIES, emptyBillType, type BillTypeOption, type BillToType, type ClubChargesOption, type OrgOption, type OrganizationBillTypeForm } from "./types";

interface BillingSectionProps {
  defaultCurrency: string;
  onChangeDefaultCurrency: (currency: string) => void;
  billTypes: OrganizationBillTypeForm[];
  onChangeBillTypes: (billTypes: OrganizationBillTypeForm[]) => void;
  billTypeOptions: BillTypeOption[];
  organizationOptions: OrgOption[];
  canEdit: boolean;
}

const CLUB_CHARGES_OPTIONS: { value: ClubChargesOption; label: string }[] = [
  { value: "NO_GROUPING", label: "No Grouping of Invoice Charges" },
  { value: "GROUP_BY_SHIPMENT", label: "Group by Shipment" },
  { value: "GROUP_BY_JOB", label: "Group by Job" },
];

const BILL_TO_OPTIONS: { value: BillToType; label: string }[] = [
  { value: "DIRECT", label: "Direct" },
  { value: "OTHER", label: "Other" },
];

export function BillingSection({
  defaultCurrency,
  onChangeDefaultCurrency,
  billTypes,
  onChangeBillTypes,
  billTypeOptions,
  organizationOptions,
  canEdit,
}: BillingSectionProps) {
  function update(key: string, patch: Partial<OrganizationBillTypeForm>) {
    onChangeBillTypes(billTypes.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  }
  function remove(key: string) {
    onChangeBillTypes(billTypes.filter((b) => b._key !== key));
  }

  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-4">
      <Select
        label="Default Currency"
        placeholder="Select currency"
        value={defaultCurrency}
        onChange={(e) => onChangeDefaultCurrency(e.target.value)}
        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        className="max-w-xs"
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Default Bill Types</p>
        <div className="flex flex-col gap-2">
          {billTypes.map((bt) => (
            <div key={bt._key} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto] items-end gap-2 rounded-md border border-border-subtle p-2">
              <Select
                label="Bill Type"
                placeholder="Select bill type"
                value={bt.billTypeId}
                onChange={(e) => update(bt._key, { billTypeId: e.target.value })}
                options={billTypeOptions.filter((o) => o.isActive).map((o) => ({ value: o.id, label: o.name }))}
              />
              <Input
                label="Due After (days)"
                type="number"
                value={bt.dueAfterDays}
                onChange={(e) => update(bt._key, { dueAfterDays: e.target.value })}
              />
              <Select
                label="Bill To"
                value={bt.billTo}
                onChange={(e) => update(bt._key, { billTo: e.target.value as BillToType })}
                options={BILL_TO_OPTIONS}
              />
              <Select
                label="Organization"
                placeholder={bt.billTo === "OTHER" ? "Select organization" : "N/A"}
                value={bt.billToOrganizationId}
                onChange={(e) => update(bt._key, { billToOrganizationId: e.target.value })}
                options={organizationOptions.map((o) => ({ value: o.id, label: o.name }))}
                disabled={bt.billTo !== "OTHER"}
              />
              <Select
                label="Club Charges"
                value={bt.clubCharges}
                onChange={(e) => update(bt._key, { clubCharges: e.target.value as ClubChargesOption })}
                options={CLUB_CHARGES_OPTIONS}
              />
              <Button type="button" size="sm" variant="danger" onClick={() => remove(bt._key)}>
                Remove
              </Button>
              <div className="col-span-full">
                <Checkbox
                  label="Override credit period"
                  checked={bt.overrideCreditPeriod}
                  onChange={(e) => update(bt._key, { overrideCreditPeriod: e.target.checked })}
                />
              </div>
            </div>
          ))}
          {canEdit && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onChangeBillTypes([...billTypes, emptyBillType()])}>
              + Add bill type
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  );
}
