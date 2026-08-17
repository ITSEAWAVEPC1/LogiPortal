"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { GeneralSection } from "./GeneralSection";
import { BranchesSection } from "./BranchesSection";
import { AccountInfoSection } from "./AccountInfoSection";
import { BillingSection } from "./BillingSection";
import { toApiPayload } from "./to-api-payload";
import {
  EMPTY_CUSTOMER_ACCOUNT_INFO,
  EMPTY_VENDOR_ACCOUNT_INFO,
  type BillTypeOption,
  type OrganizationFieldAccess,
  type OrganizationFormState,
  type OrgOption,
  type StaffOption,
} from "./types";

type Tab = "general" | "branches" | "accountInfo" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "branches", label: "Branches" },
  { key: "accountInfo", label: "Account Info" },
  { key: "billing", label: "Billing" },
];

interface OrganizationEditorProps {
  mode: "create" | "edit";
  organizationId?: string;
  initialForm: OrganizationFormState;
  homeBranches: { id: string; name: string }[];
  staff: StaffOption[];
  billTypeOptions: BillTypeOption[];
  organizationOptions: OrgOption[];
  fieldAccess: OrganizationFieldAccess;
  /** Whole-resource "customers":"edit" capability — gates the General tab's
   *  identity fields (name, role flags, KYC), independent of the finer
   *  Account Info/Billing/Branches field groups below. */
  canEditGeneral: boolean;
}

export function OrganizationEditor({
  mode,
  organizationId,
  initialForm,
  homeBranches,
  staff,
  billTypeOptions,
  organizationOptions,
  fieldAccess,
  canEditGeneral,
}: OrganizationEditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState<OrganizationFormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canEditBranches = fieldAccess.branches === "EDIT" && fieldAccess.addresses === "EDIT" && fieldAccess.contacts === "EDIT";
  const canEditAccountInfo = fieldAccess.accountInfo === "EDIT";
  const canEditBilling = fieldAccess.billing === "EDIT";
  const canSave = canEditGeneral || canEditBranches || canEditAccountInfo || canEditBilling;

  function patch(p: Partial<OrganizationFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);

    const url = mode === "edit" ? `/api/customers/${organizationId}` : "/api/customers";
    const method = mode === "edit" ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiPayload(form)),
    });

    setSubmitting(false);
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }

    router.push("/customers");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{mode === "edit" ? "Edit Customer" : "New Customer"}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/customers")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting || !form.name.trim() || !canSave}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-status-danger-fg">
          <p className="text-sm text-status-danger-fg">{error}</p>
        </Card>
      )}

      <div className="mb-4 flex gap-1 border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-brand-teal text-brand-teal" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {tab === "general" && <GeneralSection form={form} onChange={patch} branches={homeBranches} canEdit={canEditGeneral} />}
        {tab === "branches" && (
          <BranchesSection branches={form.branches} onChange={(branches) => patch({ branches })} staff={staff} canEdit={canEditBranches} />
        )}
        {tab === "accountInfo" && (
          <AccountInfoSection
            customerAccountInfo={form.customerAccountInfo}
            vendorAccountInfo={form.vendorAccountInfo}
            onChangeCustomer={(customerAccountInfo) => patch({ customerAccountInfo: customerAccountInfo ?? EMPTY_CUSTOMER_ACCOUNT_INFO })}
            onChangeVendor={(vendorAccountInfo) => patch({ vendorAccountInfo: vendorAccountInfo ?? EMPTY_VENDOR_ACCOUNT_INFO })}
            bankAccounts={form.bankAccounts}
            onChangeBankAccounts={(bankAccounts) => patch({ bankAccounts })}
            branches={form.branches}
            canEdit={canEditAccountInfo}
          />
        )}
        {tab === "billing" && (
          <BillingSection
            defaultCurrency={form.defaultCurrency}
            onChangeDefaultCurrency={(defaultCurrency) => patch({ defaultCurrency })}
            billTypes={form.billTypes}
            onChangeBillTypes={(billTypes) => patch({ billTypes })}
            billTypeOptions={billTypeOptions}
            organizationOptions={organizationOptions}
            canEdit={canEditBilling}
          />
        )}
      </Card>
    </div>
  );
}
