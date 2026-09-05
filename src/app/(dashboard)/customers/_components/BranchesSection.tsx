"use client";

import { useState } from "react";
import { Badge, Button, Checkbox, Input, Select } from "@/components/ui";
import {
  emptyAccountManager,
  emptyAddress,
  emptyBranch,
  emptyContact,
  type BranchAccountManagerForm,
  type BranchAddressForm,
  type BranchContactForm,
  type OrganizationBranchForm,
  type StaffOption,
} from "./types";

type SubTab = "address" | "more" | "contact" | "managers";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "more", label: "More Addresses" },
  { key: "contact", label: "Contact" },
  { key: "managers", label: "Account Managers" },
];

const ADDRESS_TYPES = ["Delivery", "Billing", "Registered", "Warehouse", "Other"];

interface BranchesSectionProps {
  branches: OrganizationBranchForm[];
  onChange: (branches: OrganizationBranchForm[]) => void;
  staff: StaffOption[];
  canEdit: boolean;
}

export function BranchesSection({ branches, onChange, staff, canEdit }: BranchesSectionProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(branches[0]?._key ?? null);
  const [subTab, setSubTab] = useState<SubTab>("address");

  const selected = branches.find((b) => b._key === selectedKey) ?? null;

  function updateBranch(key: string, patch: Partial<OrganizationBranchForm>) {
    onChange(branches.map((b) => (b._key === key ? { ...b, ...patch } : b)));
  }

  function addBranch() {
    const branch = emptyBranch();
    onChange([...branches, branch]);
    setSelectedKey(branch._key);
    setSubTab("address");
  }

  function removeBranch(key: string) {
    onChange(branches.filter((b) => b._key !== key));
    if (selectedKey === key) setSelectedKey(null);
  }

  return (
    <div className="grid grid-cols-[220px_1fr] gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Branches</p>
          {canEdit && (
            <Button type="button" size="sm" variant="secondary" onClick={addBranch}>
              + Add
            </Button>
          )}
        </div>
        <ul className="flex flex-col gap-1">
          {branches.map((b) => (
            <li key={b._key}>
              <button
                type="button"
                onClick={() => {
                  setSelectedKey(b._key);
                  setSubTab("address");
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                  b._key === selectedKey ? "bg-brand-teal/10 text-brand-teal" : "text-text-primary hover:bg-background"
                }`}
              >
                <span className="truncate">{b.branchName || "(unnamed branch)"}</span>
                <span className="flex gap-1">
                  {b.isDefault && <Badge variant="active">Default</Badge>}
                  {b.isDeactivated && <Badge variant="neutral">Off</Badge>}
                </span>
              </button>
            </li>
          ))}
          {branches.length === 0 && <li className="text-sm text-text-tertiary">No branches yet.</li>}
        </ul>
      </div>

      <div>
        {!selected ? (
          <p className="text-sm text-text-tertiary">Select or add a branch to edit its details.</p>
        ) : (
          <div>
            <div className="mb-3 flex gap-1 border-b border-border-subtle">
              {SUB_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSubTab(t.key)}
                  className={`px-3 py-2 text-sm font-medium ${
                    subTab === t.key
                      ? "border-b-2 border-brand-teal text-brand-teal"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto py-2">
                {canEdit && (
                  <Button type="button" size="sm" variant="danger" onClick={() => removeBranch(selected._key)}>
                    Remove branch
                  </Button>
                )}
              </div>
            </div>

            {subTab === "address" && (
              <BranchAddressTab branch={selected} onChange={(patch) => updateBranch(selected._key, patch)} staff={staff} canEdit={canEdit} />
            )}
            {subTab === "more" && (
              <MoreAddressesTab
                addresses={selected.addresses}
                onChange={(addresses) => updateBranch(selected._key, { addresses })}
                canEdit={canEdit}
              />
            )}
            {subTab === "contact" && (
              <ContactsTab
                contacts={selected.contacts}
                onChange={(contacts) => updateBranch(selected._key, { contacts })}
                canEdit={canEdit}
              />
            )}
            {subTab === "managers" && (
              <AccountManagersTab
                accountManagers={selected.accountManagers}
                onChange={(accountManagers) => updateBranch(selected._key, { accountManagers })}
                staff={staff}
                canEdit={canEdit}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BranchAddressTab({
  branch,
  onChange,
  staff,
  canEdit,
}: {
  branch: OrganizationBranchForm;
  onChange: (patch: Partial<OrganizationBranchForm>) => void;
  staff: StaffOption[];
  canEdit: boolean;
}) {
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="Branch name" required value={branch.branchName} onChange={(e) => onChange({ branchName: e.target.value })} />
        <Input label="Website" value={branch.website} onChange={(e) => onChange({ website: e.target.value })} />
      </div>
      <Input label="Address" value={branch.address} onChange={(e) => onChange({ address: e.target.value })} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Input label="Country" value={branch.country} onChange={(e) => onChange({ country: e.target.value })} />
        <Input label="State/Province" value={branch.state} onChange={(e) => onChange({ state: e.target.value })} />
        <Input label="City" value={branch.city} onChange={(e) => onChange({ city: e.target.value })} />
        <Input label="Postal Code" value={branch.postalCode} onChange={(e) => onChange({ postalCode: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Input label="Telephone" value={branch.telephone} onChange={(e) => onChange({ telephone: e.target.value })} />
        <Input label="Fax" value={branch.fax} onChange={(e) => onChange({ fax: e.target.value })} />
        <Input label="Email" type="email" value={branch.email} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Select
          label="Sales Person"
          placeholder="Unassigned"
          value={branch.salesPersonId}
          onChange={(e) => onChange({ salesPersonId: e.target.value })}
          options={staff.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          label="Collection Executive"
          placeholder="Unassigned"
          value={branch.collectionExecutiveId}
          onChange={(e) => onChange({ collectionExecutiveId: e.target.value })}
          options={staff.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
      <Input label="Taxable Type" value={branch.taxableType} onChange={(e) => onChange({ taxableType: e.target.value })} />
      <div className="flex gap-6">
        <Checkbox label="Set as Default" checked={branch.isDefault} onChange={(e) => onChange({ isDefault: e.target.checked })} />
        <Checkbox label="Deactivate" checked={branch.isDeactivated} onChange={(e) => onChange({ isDeactivated: e.target.checked })} />
        <Checkbox label="LOB wise" checked={branch.lobWise} onChange={(e) => onChange({ lobWise: e.target.checked })} />
      </div>
    </fieldset>
  );
}

function MoreAddressesTab({
  addresses,
  onChange,
  canEdit,
}: {
  addresses: BranchAddressForm[];
  onChange: (addresses: BranchAddressForm[]) => void;
  canEdit: boolean;
}) {
  function update(key: string, patch: Partial<BranchAddressForm>) {
    onChange(addresses.map((a) => (a._key === key ? { ...a, ...patch } : a)));
  }
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      {addresses.map((a) => (
        <div key={a._key} className="grid grid-cols-[140px_1fr_1fr_1fr_auto] items-end gap-2 rounded-md border border-border-subtle p-2">
          <Select
            label="Type"
            value={a.addressType}
            onChange={(e) => update(a._key, { addressType: e.target.value })}
            options={ADDRESS_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <Input label="Name" value={a.name} onChange={(e) => update(a._key, { name: e.target.value })} />
          <Input label="Address" value={a.address} onChange={(e) => update(a._key, { address: e.target.value })} />
          <Input label="City" value={a.city} onChange={(e) => update(a._key, { city: e.target.value })} />
          <Button type="button" size="sm" variant="danger" onClick={() => onChange(addresses.filter((x) => x._key !== a._key))}>
            Remove
          </Button>
          <Input label="Postal Code" value={a.postalCode} onChange={(e) => update(a._key, { postalCode: e.target.value })} />
          <Input label="State" value={a.state} onChange={(e) => update(a._key, { state: e.target.value })} />
          <Input label="Telephone" value={a.telephone} onChange={(e) => update(a._key, { telephone: e.target.value })} />
          <Input label="Email" type="email" value={a.email} onChange={(e) => update(a._key, { email: e.target.value })} />
        </div>
      ))}
      {canEdit && (
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...addresses, emptyAddress()])}>
          + Add address
        </Button>
      )}
    </fieldset>
  );
}

function ContactsTab({
  contacts,
  onChange,
  canEdit,
}: {
  contacts: BranchContactForm[];
  onChange: (contacts: BranchContactForm[]) => void;
  canEdit: boolean;
}) {
  function update(key: string, patch: Partial<BranchContactForm>) {
    onChange(contacts.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  }
  function setPrimary(key: string) {
    onChange(contacts.map((c) => ({ ...c, isPrimary: c._key === key })));
  }
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      {contacts.map((c) => (
        <div key={c._key} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-md border border-border-subtle p-2">
          <Input label="Contact Name" value={c.contactName} onChange={(e) => update(c._key, { contactName: e.target.value })} />
          <Input label="Title/Designation" value={c.titleDesignation} onChange={(e) => update(c._key, { titleDesignation: e.target.value })} />
          <Input label="Department" value={c.department} onChange={(e) => update(c._key, { department: e.target.value })} />
          <Input label="Mobile" value={c.mobile} onChange={(e) => update(c._key, { mobile: e.target.value })} />
          <Button type="button" size="sm" variant="danger" onClick={() => onChange(contacts.filter((x) => x._key !== c._key))}>
            Remove
          </Button>
          <Input label="Telephone" value={c.telephone} onChange={(e) => update(c._key, { telephone: e.target.value })} />
          <Input label="Email" type="email" value={c.email} onChange={(e) => update(c._key, { email: e.target.value })} />
          <Checkbox label="Primary contact" checked={c.isPrimary} onChange={() => setPrimary(c._key)} />
        </div>
      ))}
      {canEdit && (
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...contacts, emptyContact()])}>
          + Add contact
        </Button>
      )}
    </fieldset>
  );
}

function AccountManagersTab({
  accountManagers,
  onChange,
  staff,
  canEdit,
}: {
  accountManagers: BranchAccountManagerForm[];
  onChange: (accountManagers: BranchAccountManagerForm[]) => void;
  staff: StaffOption[];
  canEdit: boolean;
}) {
  function update(key: string, patch: Partial<BranchAccountManagerForm>) {
    onChange(accountManagers.map((m) => (m._key === key ? { ...m, ...patch } : m)));
  }
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      {accountManagers.map((m) => (
        <div key={m._key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border border-border-subtle p-2">
          <Input label="For (category)" value={m.forCategory} onChange={(e) => update(m._key, { forCategory: e.target.value })} />
          <Select
            label="Manager"
            placeholder="Unassigned"
            value={m.managerUserId}
            onChange={(e) => update(m._key, { managerUserId: e.target.value })}
            options={staff.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Button type="button" size="sm" variant="danger" onClick={() => onChange(accountManagers.filter((x) => x._key !== m._key))}>
            Remove
          </Button>
        </div>
      ))}
      {canEdit && (
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...accountManagers, emptyAccountManager()])}>
          + Add account manager
        </Button>
      )}
    </fieldset>
  );
}
