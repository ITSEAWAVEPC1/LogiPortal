"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Select } from "@/components/ui";
import { CustomerCombobox, type CustomerOption } from "@/components/shared/CustomerCombobox";
import { formatQuotationRef } from "@/lib/validation/quotation";

interface Branch {
  id: string;
  name: string;
}

interface ConvertedQuotation {
  id: string;
  sequenceNumber: number;
  createdAt: string;
  organization: { id: string; name: string };
  _count: { enquiries: number };
}

interface FromQuotationRow {
  quotationEnquiryId: string;
  enquiryRef: string;
  shipmentType: "IMPORT" | "EXPORT" | null;
  serviceTypes: string[];
  jobId: string | null;
}

export function NewJobForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"quotation" | "direct">("quotation");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- From quotation ---
  const [quotations, setQuotations] = useState<ConvertedQuotation[]>([]);
  const [quotationId, setQuotationId] = useState("");
  const [rows, setRows] = useState<FromQuotationRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Direct ---
  const [branchId, setBranchId] = useState("");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [shipmentType, setShipmentType] = useState("");

  useEffect(() => {
    fetch("/api/quotations?status=CONVERTED")
      .then((r) => (r.ok ? r.json() : { quotations: [] }))
      .then((body) => setQuotations(body.quotations ?? []))
      .catch(() => setQuotations([]));
  }, []);

  useEffect(() => {
    if (!quotationId) return;
    let cancelled = false;
    fetch(`/api/jobs/from-quotation?quotationId=${quotationId}`)
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((body) => {
        if (cancelled) return;
        const fetched: FromQuotationRow[] = body.rows ?? [];
        setRows(fetched);
        setSelected(new Set(fetched.filter((row) => !row.jobId).map((row) => row.quotationEnquiryId)));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quotationId]);

  function selectQuotation(value: string) {
    setQuotationId(value);
    if (!value) {
      setRows([]);
      setSelected(new Set());
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createFromQuotation() {
    setSubmitting(true);
    setError(null);
    const ids = [...selected];
    let firstJobId: string | null = null;
    for (const quotationEnquiryId of ids) {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationEnquiryId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitting(false);
        setError(body.error ?? "Failed to create job");
        return;
      }
      firstJobId = firstJobId ?? body.job.id;
    }
    setSubmitting(false);
    if (firstJobId) router.push(`/jobs/${firstJobId}`);
    else router.refresh();
  }

  async function createDirect() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, organizationId: customer?.id, shipmentType }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.push(`/jobs/${body.job.id}`);
  }

  return (
    <Card>
      <div className="mb-4 flex gap-2 border-b border-border-subtle">
        {(["quotation", "direct"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              mode === m ? "border-brand-teal text-brand-teal" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {m === "quotation" ? "From a Quotation" : "Direct (no quotation)"}
          </button>
        ))}
      </div>

      {mode === "quotation" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Pick a converted quotation, then choose which of its enquiries to turn into Jobs. Everything already captured
            carries over — you complete the consignment details on the next screen.
          </p>
          <Select
            label="Converted Quotation"
            placeholder={quotations.length ? "Select..." : "No converted quotations"}
            value={quotationId}
            onChange={(e) => selectQuotation(e.target.value)}
            options={quotations.map((q) => ({
              value: q.id,
              label: `${formatQuotationRef(q.createdAt, q.sequenceNumber)} — ${q.organization.name} (${q._count.enquiries})`,
            }))}
          />

          {rows.length > 0 && (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.quotationEnquiryId} className="flex items-center justify-between rounded-md border border-border-subtle p-2">
                  <Checkbox
                    label={`${row.enquiryRef}${row.shipmentType ? ` · ${row.shipmentType}` : ""}`}
                    checked={selected.has(row.quotationEnquiryId)}
                    onChange={() => toggleRow(row.quotationEnquiryId)}
                    disabled={!!row.jobId}
                  />
                  {row.jobId && (
                    <Badge variant="neutral">
                      <a href={`/jobs/${row.jobId}`} className="hover:underline">
                        Job exists
                      </a>
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-status-danger-fg">{error}</p>}
          <Button onClick={createFromQuotation} disabled={selected.size === 0 || submitting}>
            {submitting ? "Creating..." : `Create ${selected.size || ""} Job${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {mode === "direct" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Start a Job with no linked quotation. Pick branch, customer and shipment type — the rest is filled in on the
            next screen with autosave.
          </p>
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
          <Select
            label="Shipment Type"
            placeholder="Select..."
            value={shipmentType}
            onChange={(e) => setShipmentType(e.target.value)}
            options={[
              { value: "IMPORT", label: "Import" },
              { value: "EXPORT", label: "Export" },
            ]}
          />
          {error && <p className="text-sm text-status-danger-fg">{error}</p>}
          <Button onClick={createDirect} disabled={!branchId || !customer || !shipmentType || submitting}>
            {submitting ? "Creating..." : "Create Job"}
          </Button>
        </div>
      )}
    </Card>
  );
}
