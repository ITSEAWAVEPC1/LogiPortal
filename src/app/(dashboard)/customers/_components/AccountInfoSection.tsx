"use client";

import { useState } from "react";
import { Button, Checkbox, Input, Select } from "@/components/ui";
import {
  CURRENCIES,
  EMPTY_CUSTOMER_ACCOUNT_INFO,
  EMPTY_VENDOR_ACCOUNT_INFO,
  emptyBankAccount,
  type BankAccountForm,
  type CustomerAccountInfoForm,
  type DueDateBasis,
  type OrganizationBranchForm,
  type VendorAccountInfoForm,
} from "./types";

type Party = "customer" | "vendor";

interface AccountInfoSectionProps {
  customerAccountInfo: CustomerAccountInfoForm | null;
  vendorAccountInfo: VendorAccountInfoForm | null;
  onChangeCustomer: (info: CustomerAccountInfoForm | null) => void;
  onChangeVendor: (info: VendorAccountInfoForm | null) => void;
  bankAccounts: BankAccountForm[];
  onChangeBankAccounts: (accounts: BankAccountForm[]) => void;
  branches: OrganizationBranchForm[];
  canEdit: boolean;
}

const DUE_DATE_OPTIONS: { value: DueDateBasis; label: string }[] = [
  { value: "TRANSACTION_DATE", label: "Transaction Date" },
  { value: "INVOICE_DATE", label: "Invoice Date" },
  { value: "BILL_DATE", label: "Bill Date" },
];

export function AccountInfoSection({
  customerAccountInfo,
  vendorAccountInfo,
  onChangeCustomer,
  onChangeVendor,
  bankAccounts,
  onChangeBankAccounts,
  branches,
  canEdit,
}: AccountInfoSectionProps) {
  const [party, setParty] = useState<Party>("customer");
  const [bankKind, setBankKind] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-border-subtle">
        {(["customer", "vendor"] as Party[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setParty(p)}
            className={`px-3 py-2 text-sm font-medium capitalize ${
              party === p ? "border-b-2 border-brand-teal text-brand-teal" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {party === "customer" ? (
        <CustomerAccountInfoForm_
          info={customerAccountInfo}
          onChange={onChangeCustomer}
          canEdit={canEdit}
        />
      ) : (
        <VendorAccountInfoForm_ info={vendorAccountInfo} onChange={onChangeVendor} canEdit={canEdit} />
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-text-primary">Bank Details</p>
        <div className="mb-3 flex gap-1 border-b border-border-subtle">
          {(["PAYABLE", "RECEIVABLE"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setBankKind(k)}
              className={`px-3 py-2 text-sm font-medium capitalize ${
                bankKind === k ? "border-b-2 border-brand-teal text-brand-teal" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {k === "PAYABLE" ? "Payable Details" : "Receivable Details"}
            </button>
          ))}
        </div>
        <BankAccountsTable
          accounts={bankAccounts.filter((a) => a.accountKind === bankKind)}
          allAccounts={bankAccounts}
          onChange={onChangeBankAccounts}
          branches={branches}
          kind={bankKind}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function CustomerAccountInfoForm_({
  info,
  onChange,
  canEdit,
}: {
  info: CustomerAccountInfoForm | null;
  onChange: (info: CustomerAccountInfoForm | null) => void;
  canEdit: boolean;
}) {
  const value = info ?? EMPTY_CUSTOMER_ACCOUNT_INFO;
  function patch(p: Partial<CustomerAccountInfoForm>) {
    onChange({ ...value, ...p });
  }
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-3">
        <Input
          label="Credit Limit"
          type="number"
          value={value.creditLimit}
          disabled={value.isUnlimitedCredit}
          onChange={(e) => patch({ creditLimit: e.target.value })}
        />
        <Checkbox label="Unlimited" checked={value.isUnlimitedCredit} onChange={(e) => patch({ isUnlimitedCredit: e.target.checked })} />
        <Checkbox label="Cash on Delivery" checked={value.cashOnDelivery} onChange={(e) => patch({ cashOnDelivery: e.target.checked })} />
      </div>
      <Checkbox
        label="Include WIP shipment in overdue"
        checked={value.includeWipShipmentInOverdue}
        onChange={(e) => patch({ includeWipShipmentInOverdue: e.target.checked })}
      />
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
        <Checkbox label="Credit on hold" checked={value.isCreditOnHold} onChange={(e) => patch({ isCreditOnHold: e.target.checked })} />
        <Input
          label="Credit on hold remark"
          disabled={!value.isCreditOnHold}
          value={value.creditOnHoldRemark}
          onChange={(e) => patch({ creditOnHoldRemark: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Select
          label="Receivable Credit Period"
          placeholder="No. of Days"
          value={value.receivableCreditPeriodDays}
          onChange={(e) => patch({ receivableCreditPeriodDays: e.target.value })}
          options={["0", "7", "15", "30", "45", "60", "90"].map((d) => ({ value: d, label: `${d} days` }))}
        />
        <Input label="Customer G/L Code" value={value.customerGLCode} onChange={(e) => patch({ customerGLCode: e.target.value })} />
        <Select
          label="Currency"
          placeholder="Select currency"
          value={value.currency}
          onChange={(e) => patch({ currency: e.target.value })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <Input
        label="Notification Emails"
        placeholder="comma-separated"
        value={value.notificationEmails}
        onChange={(e) => patch({ notificationEmails: e.target.value })}
      />
      <Checkbox label="TDS Receivable" checked={value.tdsReceivable} onChange={(e) => patch({ tdsReceivable: e.target.checked })} />
    </fieldset>
  );
}

function VendorAccountInfoForm_({
  info,
  onChange,
  canEdit,
}: {
  info: VendorAccountInfoForm | null;
  onChange: (info: VendorAccountInfoForm | null) => void;
  canEdit: boolean;
}) {
  const value = info ?? EMPTY_VENDOR_ACCOUNT_INFO;
  function patch(p: Partial<VendorAccountInfoForm>) {
    onChange({ ...value, ...p });
  }
  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-2">
        <Input
          label="Credit Limit"
          type="number"
          value={value.creditLimit}
          disabled={value.isUnlimitedCredit}
          onChange={(e) => patch({ creditLimit: e.target.value })}
        />
        <Checkbox label="Unlimited" checked={value.isUnlimitedCredit} onChange={(e) => patch({ isUnlimitedCredit: e.target.checked })} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Select
          label="Payable Credit Period"
          placeholder="No. of Days"
          value={value.payableCreditPeriodDays}
          onChange={(e) => patch({ payableCreditPeriodDays: e.target.value })}
          options={["0", "7", "15", "30", "45", "60", "90"].map((d) => ({ value: d, label: `${d} days` }))}
        />
        <Select
          label="Due Date Calculated On"
          value={value.dueDateCalculatedOn}
          onChange={(e) => patch({ dueDateCalculatedOn: e.target.value as DueDateBasis })}
          options={DUE_DATE_OPTIONS}
        />
        <Select
          label="Currency"
          placeholder="Select currency"
          value={value.currency}
          onChange={(e) => patch({ currency: e.target.value })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <Input label="Vendor G/L Code" value={value.vendorGLCode} onChange={(e) => patch({ vendorGLCode: e.target.value })} />
      <Input
        label="Notification Emails"
        placeholder="comma-separated"
        value={value.notificationEmails}
        onChange={(e) => patch({ notificationEmails: e.target.value })}
      />
      <div className="flex gap-6">
        <Checkbox label="Payment on hold" checked={value.isPaymentOnHold} onChange={(e) => patch({ isPaymentOnHold: e.target.checked })} />
        <Checkbox label="TDS Payable" checked={value.tdsPayable} onChange={(e) => patch({ tdsPayable: e.target.checked })} />
      </div>
    </fieldset>
  );
}

function BankAccountsTable({
  accounts,
  allAccounts,
  onChange,
  branches,
  kind,
  canEdit,
}: {
  accounts: BankAccountForm[];
  allAccounts: BankAccountForm[];
  onChange: (accounts: BankAccountForm[]) => void;
  branches: OrganizationBranchForm[];
  kind: "PAYABLE" | "RECEIVABLE";
  canEdit: boolean;
}) {
  function update(key: string, patch: Partial<BankAccountForm>) {
    onChange(allAccounts.map((a) => (a._key === key ? { ...a, ...patch } : a)));
  }
  function remove(key: string) {
    onChange(allAccounts.filter((a) => a._key !== key));
  }
  function add() {
    if (branches.length === 0) return;
    onChange([...allAccounts, { ...emptyBankAccount(branches[0]._key), accountKind: kind }]);
  }

  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-3">
      {accounts.map((a) => (
        <div
          key={a._key}
          className={`grid items-end gap-2 rounded-md border border-border-subtle p-2 ${
            kind === "RECEIVABLE" ? "grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto]" : "grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
          }`}
        >
          <Select
            label="Organization Branch"
            value={a.branchKey}
            onChange={(e) => update(a._key, { branchKey: e.target.value })}
            options={branches.map((b) => ({ value: b._key, label: b.branchName || "(unnamed branch)" }))}
          />
          <Input label="Bank Name" value={a.bankName} onChange={(e) => update(a._key, { bankName: e.target.value })} />
          <Input label="Bank Branch" value={a.bankBranch} onChange={(e) => update(a._key, { bankBranch: e.target.value })} />
          <Input label="Account Number" value={a.accountNumber} onChange={(e) => update(a._key, { accountNumber: e.target.value })} />
          <Input label="IFSC" value={a.ifsc} onChange={(e) => update(a._key, { ifsc: e.target.value })} />
          {kind === "RECEIVABLE" && (
            <Select
              label="Trns. Currency"
              placeholder="Select"
              value={a.transactionCurrency}
              onChange={(e) => update(a._key, { transactionCurrency: e.target.value })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          )}
          <Button type="button" size="sm" variant="danger" onClick={() => remove(a._key)}>
            Remove
          </Button>
        </div>
      ))}
      {canEdit && (
        <Button type="button" size="sm" variant="secondary" disabled={branches.length === 0} onClick={add}>
          + Add {kind === "PAYABLE" ? "payable" : "receivable"} account
        </Button>
      )}
      {branches.length === 0 && <p className="text-xs text-text-tertiary">Add a branch first to attach bank accounts.</p>}
    </fieldset>
  );
}
