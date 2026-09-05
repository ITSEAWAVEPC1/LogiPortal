"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Input, Select, Textarea } from "@/components/ui";
import type { Role } from "@/lib/permissions/roles";
import type { JobFieldGroup } from "@/lib/permissions/field-permissions";
import { useAutosave } from "@/lib/hooks/useAutosave";
import {
  EXPORT_STUFFING_OPTIONS,
  formatJobRef,
  INCOTERM_OPTIONS,
  JOB_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
} from "@/lib/validation/job";
import { ContainerDetailsEditor, type ContainerRow } from "./ContainerDetailsEditor";
import { PartyFields, partyFromRaw, type PartyState } from "./PartyFields";
import { ReviewModal } from "./ReviewModal";

type ServiceTypeValue = (typeof SERVICE_TYPE_OPTIONS)[number]["value"];
type JobStatus = (typeof JOB_STATUS_OPTIONS)[number]["value"];
type FieldAccess = Record<JobFieldGroup, "NONE" | "VIEW" | "EDIT">;

interface RawParty {
  name: string | null;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
}
interface RawContainer {
  containerNumber: string | null;
  sealNumber: string | null;
  containerType: string | null;
  count: number | null;
  grossWeight: number | null;
  tareWeight: number | null;
  netWeight: number | null;
  packageCount: number | null;
}
interface RawCharge {
  category?: string;
  description?: string;
  rate?: number | null;
  quantity?: number | null;
  amount?: number | null;
  currency?: string;
}

export interface JobDetail {
  id: string;
  sequenceNumber: number;
  referenceNo: string | null;
  sourceReference: string | null;
  status: JobStatus;
  origin: "QUOTATION" | "DIRECT" | "IMPORTED";
  createdAt: string | Date;
  shipmentType: "IMPORT" | "EXPORT";
  serviceTypes?: ServiceTypeValue[];
  incoterm?: string | null;
  exportStuffingType?: "NONE" | "DOCK" | "FACTORY" | null;
  organization: { id: string; name: string };
  branch: { id: string; name: string };
  createdBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewNote: string | null;
  quotationEnquiry: { id: string; quotationId: string } | null;
  agentDetails?: string | null;
  placeOfReceipt?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  placeOfDelivery?: string | null;
  shippingLineName?: string | null;
  cfsName?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  freeDaysAtPod?: number | null;
  totalGrossWeight?: number | null;
  totalNetWeight?: number | null;
  totalPackages?: number | null;
  volumeCbm?: number | null;
  commodity?: string | null;
  hsCode?: string | null;
  charges?: RawCharge[] | null;
  chargesCurrency?: string | null;
  quotedTotal?: number | null;
  dutyPaymentLiability?: string | null;
  dutyAmount?: number | null;
  dutyPaidBy?: string | null;
  internalNotes?: string | null;
  expectedDeliveryDate?: string | Date | null;
  actualDeliveryDate?: string | Date | null;
  shipperDetail?: RawParty | null;
  consigneeDetail?: RawParty | null;
  notifyPartyDetail?: RawParty | null;
  containers?: RawContainer[];
}

interface FormState {
  incoterm: string;
  exportStuffingType: string;
  serviceTypes: ServiceTypeValue[];
  agentDetails: string;
  placeOfReceipt: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  shippingLineName: string;
  cfsName: string;
  vesselName: string;
  voyageNumber: string;
  freeDaysAtPod: number | null;
  totalGrossWeight: number | null;
  totalNetWeight: number | null;
  totalPackages: number | null;
  volumeCbm: number | null;
  commodity: string;
  hsCode: string;
  containers: ContainerRow[];
  shipper: PartyState;
  consignee: PartyState;
  notify: PartyState;
  dutyPaymentLiability: string;
  dutyAmount: number | null;
  dutyPaidBy: string;
  internalNotes: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string;
}

function numOrNull(raw: string): number | null {
  return raw === "" ? null : Number(raw);
}

function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function buildInitialState(job: JobDetail): FormState {
  return {
    incoterm: job.incoterm ?? "",
    exportStuffingType: job.exportStuffingType ?? "",
    serviceTypes: job.serviceTypes ?? [],
    agentDetails: job.agentDetails ?? "",
    placeOfReceipt: job.placeOfReceipt ?? "",
    portOfLoading: job.portOfLoading ?? "",
    portOfDischarge: job.portOfDischarge ?? "",
    placeOfDelivery: job.placeOfDelivery ?? "",
    shippingLineName: job.shippingLineName ?? "",
    cfsName: job.cfsName ?? "",
    vesselName: job.vesselName ?? "",
    voyageNumber: job.voyageNumber ?? "",
    freeDaysAtPod: job.freeDaysAtPod ?? null,
    totalGrossWeight: job.totalGrossWeight ?? null,
    totalNetWeight: job.totalNetWeight ?? null,
    totalPackages: job.totalPackages ?? null,
    volumeCbm: job.volumeCbm ?? null,
    commodity: job.commodity ?? "",
    hsCode: job.hsCode ?? "",
    containers: (job.containers ?? []).map((c) => ({
      containerNumber: c.containerNumber ?? "",
      sealNumber: c.sealNumber ?? "",
      containerType: c.containerType ?? "",
      count: c.count ?? 1,
      grossWeight: c.grossWeight ?? null,
      tareWeight: c.tareWeight ?? null,
      netWeight: c.netWeight ?? null,
      packageCount: c.packageCount ?? null,
    })),
    shipper: partyFromRaw(job.shipperDetail ?? null),
    consignee: partyFromRaw(job.consigneeDetail ?? null),
    notify: partyFromRaw(job.notifyPartyDetail ?? null),
    dutyPaymentLiability: job.dutyPaymentLiability ?? "",
    dutyAmount: job.dutyAmount ?? null,
    dutyPaidBy: job.dutyPaidBy ?? "",
    internalNotes: job.internalNotes ?? "",
    expectedDeliveryDate: toDateInput(job.expectedDeliveryDate),
    actualDeliveryDate: toDateInput(job.actualDeliveryDate),
  };
}

function partyToPayload(p: PartyState) {
  return {
    name: p.name || null,
    address: p.address || null,
    contactPerson: p.contactPerson || null,
    phone: p.phone || null,
    email: p.email || null,
  };
}

function toAutosavePayload(f: FormState) {
  return {
    incoterm: f.incoterm || null,
    exportStuffingType: (f.exportStuffingType || null) as "NONE" | "DOCK" | "FACTORY" | null,
    serviceTypes: f.serviceTypes,
    agentDetails: f.agentDetails || null,
    placeOfReceipt: f.placeOfReceipt || null,
    portOfLoading: f.portOfLoading || null,
    portOfDischarge: f.portOfDischarge || null,
    placeOfDelivery: f.placeOfDelivery || null,
    shippingLineName: f.shippingLineName || null,
    cfsName: f.cfsName || null,
    vesselName: f.vesselName || null,
    voyageNumber: f.voyageNumber || null,
    freeDaysAtPod: f.freeDaysAtPod,
    totalGrossWeight: f.totalGrossWeight,
    totalNetWeight: f.totalNetWeight,
    totalPackages: f.totalPackages,
    volumeCbm: f.volumeCbm,
    commodity: f.commodity || null,
    hsCode: f.hsCode || null,
    containers: f.containers.map((c, i) => ({
      containerNumber: c.containerNumber || null,
      sealNumber: c.sealNumber || null,
      containerType: c.containerType || null,
      count: c.count,
      grossWeight: c.grossWeight,
      tareWeight: c.tareWeight,
      netWeight: c.netWeight,
      packageCount: c.packageCount,
      sortOrder: i,
    })),
    shipperDetail: partyToPayload(f.shipper),
    consigneeDetail: partyToPayload(f.consignee),
    notifyPartyDetail: partyToPayload(f.notify),
    dutyPaymentLiability: f.dutyPaymentLiability || null,
    dutyAmount: f.dutyAmount,
    dutyPaidBy: f.dutyPaidBy || null,
    internalNotes: f.internalNotes || null,
    expectedDeliveryDate: f.expectedDeliveryDate || null,
    actualDeliveryDate: f.actualDeliveryDate || null,
  };
}

const STATUS_BADGE: Record<JobStatus, "pending" | "active" | "success" | "danger" | "neutral"> = {
  DRAFT: "pending",
  PENDING_REVIEW: "active",
  NEEDS_CORRECTION: "danger",
  WORKFLOW_IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

interface JobFormProps {
  job: JobDetail;
  role: Role;
  canEdit: boolean;
  canApprove: boolean;
  fieldAccess: FieldAccess;
}

export function JobForm({ job, role, canEdit, canApprove, fieldAccess }: JobFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(job));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const statusEditable = job.status === "DRAFT" || job.status === "NEEDS_CORRECTION";
  const editable = canEdit && (statusEditable || role === "ADMIN");
  const canGroup = (g: JobFieldGroup) => fieldAccess[g] !== "NONE";
  const groupDisabled = (g: JobFieldGroup) => !editable || fieldAccess[g] !== "EDIT";

  const reference = useMemo(() => formatJobRef(job), [job]);

  async function saveDraft(value: FormState) {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toAutosavePayload(value)),
    });
    if (!res.ok) throw new Error("Autosave failed");
  }

  const { status: autosaveStatus } = useAutosave(form, saveDraft, { enabled: editable });

  function set<K extends keyof FormState>(key: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }
  function toggleService(value: ServiceTypeValue) {
    setForm((prev) => {
      const removing = prev.serviceTypes.includes(value);
      return {
        ...prev,
        serviceTypes: removing ? prev.serviceTypes.filter((v) => v !== value) : [...prev.serviceTypes, value],
        // A stale Dock/Factory choice must not silently attach a stuffing
        // track once Transportation is no longer part of this job.
        exportStuffingType: removing && value === "TRANSPORTATION" ? "" : prev.exportStuffingType,
      };
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await saveDraft(form);
    } catch {
      setSubmitting(false);
      setSubmitError("Failed to save latest changes before submitting");
      return;
    }
    const res = await fetch(`/api/jobs/${job.id}/submit`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      const issues = (body.issues as { message: string }[] | undefined)?.map((i) => i.message).join("; ");
      setSubmitError(issues || body.error || "Submission failed");
      return;
    }
    router.refresh();
  }

  async function handleReview(decision: "approve" | "needs_correction", note?: string) {
    setReviewError(null);
    const res = await fetch(`/api/jobs/${job.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.error ?? "Review action failed";
      if (decision === "needs_correction") throw new Error(message);
      setReviewError(message);
      return;
    }
    setReviewModalOpen(false);
    router.refresh();
  }

  const routingDisabled = groupDisabled("portVesselContainer");
  const partiesDisabled = groupDisabled("shipperConsigneeNotify");
  const chargeTotal = (job.charges ?? []).reduce((s, c) => s + (c.amount ?? 0), 0);

  // Direction-specific detail sections. Import surfaces Agent/CFS + duty
  // clearance; Export surfaces the stuffing track. Each section stays visible
  // for the other direction only if it already holds data (bulk-imported or
  // mis-directioned jobs), so nothing populated is ever hidden.
  const isImport = job.shipmentType === "IMPORT";
  const isExport = job.shipmentType === "EXPORT";
  const hasDutyData = !!(form.dutyPaymentLiability || form.dutyAmount || form.dutyPaidBy);
  const showImportClearance = isImport || !!form.agentDetails || !!form.cfsName;
  const showDutyPayment =
    canGroup("dutyPayment") && (isImport || ["DDP", "DDU"].includes(form.incoterm) || hasDutyData);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{reference}</h1>
          <p className="text-sm text-text-secondary">
            {job.organization.name} · {job.branch.name} · {job.shipmentType}
            {job.sourceReference && job.sourceReference !== job.referenceNo && ` · from ${job.sourceReference}`}
            {job.origin === "QUOTATION" && job.sourceReference === job.referenceNo && " · from quotation"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editable && (
            <span className="text-xs text-text-tertiary">
              {autosaveStatus === "saving" && "Saving..."}
              {autosaveStatus === "saved" && "Saved"}
              {autosaveStatus === "error" && "Save failed"}
            </span>
          )}
          <Badge variant={STATUS_BADGE[job.status]}>{job.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      {job.status === "NEEDS_CORRECTION" && job.reviewNote && (
        <Card className="mb-4 border-status-danger-fg/30 bg-status-danger-bg">
          <p className="text-sm font-medium text-status-danger-fg">Flagged back for correction:</p>
          <p className="mt-1 text-sm text-status-danger-fg">{job.reviewNote}</p>
        </Card>
      )}

      {canGroup("portVesselContainer") && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Routing & Vessel</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Select
              label="Incoterm"
              placeholder="Select..."
              value={form.incoterm}
              onChange={(e) => set("incoterm", e.target.value)}
              options={INCOTERM_OPTIONS}
              disabled={routingDisabled}
            />
            <Input label="Place of Receipt" value={form.placeOfReceipt} onChange={(e) => set("placeOfReceipt", e.target.value)} disabled={routingDisabled} />
            <Input label="Port of Loading" value={form.portOfLoading} onChange={(e) => set("portOfLoading", e.target.value)} disabled={routingDisabled} />
            <Input label="Port of Discharge" value={form.portOfDischarge} onChange={(e) => set("portOfDischarge", e.target.value)} disabled={routingDisabled} />
            <Input label="Place of Delivery" value={form.placeOfDelivery} onChange={(e) => set("placeOfDelivery", e.target.value)} disabled={routingDisabled} />
            <Input label="Shipping Line" value={form.shippingLineName} onChange={(e) => set("shippingLineName", e.target.value)} disabled={routingDisabled} />
            <Input label="Vessel Name" value={form.vesselName} onChange={(e) => set("vesselName", e.target.value)} disabled={routingDisabled} />
            <Input label="Voyage No." value={form.voyageNumber} onChange={(e) => set("voyageNumber", e.target.value)} disabled={routingDisabled} />
            <Input
              label="Free Days at POD"
              type="number"
              value={form.freeDaysAtPod ?? ""}
              onChange={(e) => set("freeDaysAtPod", numOrNull(e.target.value))}
              disabled={routingDisabled}
            />
          </div>

          {showImportClearance && (
            <>
              <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Import Clearance
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Input
                  label="Agent Details"
                  value={form.agentDetails}
                  onChange={(e) => set("agentDetails", e.target.value)}
                  disabled={routingDisabled}
                />
                <Input
                  label="CFS Name"
                  value={form.cfsName}
                  onChange={(e) => set("cfsName", e.target.value)}
                  disabled={routingDisabled}
                />
              </div>
            </>
          )}

          {isExport && (
            <>
              <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Export Details
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Select
                  label="Export Stuffing Type"
                  placeholder="Select..."
                  value={form.exportStuffingType}
                  onChange={(e) => set("exportStuffingType", e.target.value)}
                  options={EXPORT_STUFFING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  disabled={routingDisabled || !form.serviceTypes.includes("TRANSPORTATION")}
                />
              </div>
              {!form.serviceTypes.includes("TRANSPORTATION") && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Select Transportation below to choose a Dock or Factory Stuffing track.
                </p>
              )}
            </>
          )}

          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium text-text-primary">Type of Services</span>
            <div className="flex flex-wrap gap-4">
              {SERVICE_TYPE_OPTIONS.map((opt) => (
                <Checkbox
                  key={opt.value}
                  label={opt.label}
                  checked={form.serviceTypes.includes(opt.value)}
                  onChange={() => toggleService(opt.value)}
                  disabled={routingDisabled}
                />
              ))}
            </div>
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary">Cargo</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Input label="Commodity" value={form.commodity} onChange={(e) => set("commodity", e.target.value)} disabled={routingDisabled} />
            <Input label="HS Code" value={form.hsCode} onChange={(e) => set("hsCode", e.target.value)} disabled={routingDisabled} />
            <Input
              label="Total Gross Weight"
              type="number"
              value={form.totalGrossWeight ?? ""}
              onChange={(e) => set("totalGrossWeight", numOrNull(e.target.value))}
              disabled={routingDisabled}
            />
            <Input
              label="Total Net Weight"
              type="number"
              value={form.totalNetWeight ?? ""}
              onChange={(e) => set("totalNetWeight", numOrNull(e.target.value))}
              disabled={routingDisabled}
            />
            <Input
              label="No. of Packages"
              type="number"
              value={form.totalPackages ?? ""}
              onChange={(e) => set("totalPackages", numOrNull(e.target.value))}
              disabled={routingDisabled}
            />
            <Input
              label="Volume (CBM)"
              type="number"
              value={form.volumeCbm ?? ""}
              onChange={(e) => set("volumeCbm", numOrNull(e.target.value))}
              disabled={routingDisabled}
            />
          </div>

          <div className="mt-4">
            <ContainerDetailsEditor
              items={form.containers}
              onChange={(containers) => set("containers", containers)}
              readOnly={routingDisabled}
            />
          </div>
        </Card>
      )}

      {canGroup("shipperConsigneeNotify") && (
        <div className="mb-4 flex flex-col gap-4">
          <PartyFields title="Shipper Details" value={form.shipper} onChange={(v) => set("shipper", v)} disabled={partiesDisabled} />
          <PartyFields title="Consignee Details" value={form.consignee} onChange={(v) => set("consignee", v)} disabled={partiesDisabled} />
          <PartyFields title="Notify Party Details" value={form.notify} onChange={(v) => set("notify", v)} disabled={partiesDisabled} />
        </div>
      )}

      {canGroup("charges") && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Charges {job.chargesCurrency ? `(${job.chargesCurrency})` : ""}
          </h2>
          {(job.charges ?? []).length === 0 ? (
            <p className="text-sm text-text-tertiary">No charges carried from a quotation.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-1">Category</th>
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(job.charges ?? []).map((c, i) => (
                  <tr key={i} className="border-t border-border-subtle">
                    <td className="py-1">{(c.category ?? "").replace(/_/g, " ")}</td>
                    <td className="py-1">{c.description}</td>
                    <td className="py-1 text-right">{(c.amount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border-subtle font-semibold">
                  <td className="py-1" colSpan={2}>
                    Total
                  </td>
                  <td className="py-1 text-right">{chargeTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-text-tertiary">
            Charges are copied from the quotation. Per-Job adjustments are made by Accounts (charge editing UI lands
            with the accounting stage).
          </p>
        </Card>
      )}

      {showDutyPayment && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Duty Payment</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Input
              label="Liability"
              placeholder="Seawave / Consignee / Customer"
              value={form.dutyPaymentLiability}
              onChange={(e) => set("dutyPaymentLiability", e.target.value)}
              disabled={groupDisabled("dutyPayment")}
            />
            <Input
              label="Duty Amount"
              type="number"
              value={form.dutyAmount ?? ""}
              onChange={(e) => set("dutyAmount", numOrNull(e.target.value))}
              disabled={groupDisabled("dutyPayment")}
            />
            <Input
              label="Paid By"
              value={form.dutyPaidBy}
              onChange={(e) => set("dutyPaidBy", e.target.value)}
              disabled={groupDisabled("dutyPayment")}
            />
          </div>
        </Card>
      )}

      {canGroup("workflowStatus") && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Delivery</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.expectedDeliveryDate}
              onChange={(e) => set("expectedDeliveryDate", e.target.value)}
              disabled={groupDisabled("workflowStatus")}
            />
            <Input
              label="Actual Delivery Date"
              type="date"
              value={form.actualDeliveryDate}
              onChange={(e) => set("actualDeliveryDate", e.target.value)}
              disabled={groupDisabled("workflowStatus")}
            />
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Auto-filled from the ETA-at-POD and Delivered workflow steps. On-time = actual on or before expected.
          </p>
        </Card>
      )}

      {canGroup("internalNotes") && (
        <Card className="mb-4">
          <Textarea
            label="Internal Notes"
            value={form.internalNotes}
            onChange={(e) => set("internalNotes", e.target.value)}
            rows={3}
            disabled={groupDisabled("internalNotes")}
          />
        </Card>
      )}

      {submitError && <p className="mb-3 text-sm text-status-danger-fg">{submitError}</p>}
      {reviewError && <p className="mb-3 text-sm text-status-danger-fg">{reviewError}</p>}

      <div className="flex justify-end gap-2">
        {canEdit && statusEditable && (
          <Button onClick={handleSubmit} disabled={submitting || autosaveStatus === "saving"}>
            {submitting ? "Submitting..." : "Submit for Review"}
          </Button>
        )}
        {canApprove && job.status === "PENDING_REVIEW" && (
          <>
            <Button variant="danger" onClick={() => setReviewModalOpen(true)}>
              Flag Back
            </Button>
            <Button onClick={() => handleReview("approve")}>Approve</Button>
          </>
        )}
      </div>

      <ReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={(note) => handleReview("needs_correction", note)}
      />
    </div>
  );
}
