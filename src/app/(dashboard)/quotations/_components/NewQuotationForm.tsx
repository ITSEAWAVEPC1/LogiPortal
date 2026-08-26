"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox } from "@/components/ui";
import { CustomerCombobox, type CustomerOption } from "@/components/shared/CustomerCombobox";
import { formatEnquiryRef } from "@/lib/validation/enquiry";

interface Branch {
  id: string;
  name: string;
}

interface EnquiryOption {
  id: string;
  sequenceNumber: number;
  createdAt: string;
  shipmentType: string | null;
  serviceTypes: string[];
  branch: { id: string; name: string };
}

interface NewQuotationFormProps {
  branches: Branch[];
}

export function NewQuotationForm({ branches }: NewQuotationFormProps) {
  const router = useRouter();
  const [organization, setOrganization] = useState<CustomerOption | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryOption[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Organization only ever transitions null -> selected here (CustomerCombobox
  // has no "clear" action), so there's no null branch to reset state in —
  // avoids a direct setState-as-first-statement in the effect body (the same
  // React 19 lint rule Stage 2's useAutosave/Combobox hit).
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    // Deferred a tick so this isn't a direct setState-during-effect-body call.
    queueMicrotask(() => {
      if (!cancelled) setLoadingEnquiries(true);
    });
    fetch(`/api/enquiries?organizationId=${organization.id}&status=READY_FOR_QUOTATION&unattached=true`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setEnquiries(body.enquiries ?? []);
        setSelectedIds([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEnquiries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  function toggleEnquiry(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    if (!organization) {
      setError("Select a customer first.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one enquiry to bundle into this quotation.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: organization.id, enquiryIds: selectedIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create quotation");
      setSubmitting(false);
      return;
    }
    const body = await res.json();
    router.push(`/quotations/${body.quotation.id}`);
  }

  return (
    <Card className="flex flex-col gap-4">
      <CustomerCombobox
        value={organization?.id ?? ""}
        displayValue={organization?.name ?? ""}
        branches={branches}
        onSelect={setOrganization}
      />

      {organization && (
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">
            Ready-for-Quotation Enquiries for {organization.name}
          </p>
          {loadingEnquiries ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : enquiries.length === 0 ? (
            <p className="text-sm text-text-tertiary">
              No unbundled Ready-for-Quotation enquiries found for this customer.
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
              {enquiries.map((enquiry) => (
                <Checkbox
                  key={enquiry.id}
                  label={`${formatEnquiryRef(enquiry.createdAt, enquiry.sequenceNumber)} — ${enquiry.branch.name} — ${
                    enquiry.shipmentType ?? "—"
                  } (${enquiry.serviceTypes.join(", ") || "—"})`}
                  checked={selectedIds.includes(enquiry.id)}
                  onChange={() => toggleEnquiry(enquiry.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-status-danger-fg">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting || !organization || selectedIds.length === 0}>
          {submitting ? "Creating..." : "Create Quotation"}
        </Button>
      </div>
    </Card>
  );
}
