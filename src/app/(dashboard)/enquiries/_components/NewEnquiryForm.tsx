"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Select } from "@/components/ui";
import { CustomerCombobox, type CustomerOption } from "./CustomerCombobox";

interface Branch {
  id: string;
  name: string;
}

export function NewEnquiryForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, organizationId: customer?.id }),
    });
    const body = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }

    router.push(`/enquiries/${body.enquiry.id}`);
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-text-secondary">
        Select the branch and customer to start. Everything else — shipment details, RFQ reason — is filled in on
        the next screen, with autosave as you go.
      </p>
      <div className="flex flex-col gap-4">
        <Select
          label="Branch"
          placeholder="Select branch..."
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
        />
        <CustomerCombobox
          value={customer?.id ?? ""}
          displayValue={customer?.name ?? ""}
          branches={branches}
          onSelect={setCustomer}
        />
        {error && <p className="text-sm text-status-danger-fg">{error}</p>}
        <Button onClick={handleCreate} disabled={!branchId || !customer || submitting}>
          {submitting ? "Creating..." : "Create Enquiry"}
        </Button>
      </div>
    </Card>
  );
}
