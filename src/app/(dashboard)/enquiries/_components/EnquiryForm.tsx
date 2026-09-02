"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Input, Select, Textarea } from "@/components/ui";
import type { Role } from "@/lib/permissions/roles";
import { SERVICE_TYPE_OPTIONS, SHIPMENT_TYPE_OPTIONS, formatEnquiryRef } from "@/lib/validation/enquiry";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { CustomerCombobox, type CustomerOption } from "@/components/shared/CustomerCombobox";
import { FreightForwardingFields, EMPTY_FREIGHT_DETAIL, type FreightDetailState } from "./FreightForwardingFields";
import { CustomsClearanceFields, EMPTY_CUSTOMS_DETAIL, type CustomsDetailState } from "./CustomsClearanceFields";
import { TransportationFields, EMPTY_TRANSPORT_DETAIL, type TransportDetailState } from "./TransportationFields";
import { ReviewModal } from "./ReviewModal";

type ServiceTypeValue = (typeof SERVICE_TYPE_OPTIONS)[number]["value"];

interface Branch {
  id: string;
  name: string;
}

interface FreightDetailRaw {
  incoterm: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  cargoMode: "LCL_AIR" | "FCL" | null;
  packageCount: number | null;
  dimensions: string | null;
  weight: number | null;
  fclWeight: number | null;
  containerType: string | null;
  containerCount: number | null;
  isOdc: boolean;
  odcDimensions: string | null;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
}

interface CustomsDetailRaw {
  hsCode: string | null;
  commodity: string | null;
}

interface TransportDetailRaw {
  pickup: string | null;
  destination: string | null;
  cargoMode: "LCL_AIR" | "FCL" | null;
  packageCount: number | null;
  dimensions: string | null;
  weight: number | null;
  fclWeight: number | null;
  containerType: string | null;
  deliveryType: "LOADED" | "DESTUFF" | null;
  isOdc: boolean;
  odcDimensions: string | null;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
}

export interface EnquiryDetail {
  id: string;
  sequenceNumber: number;
  referenceNo: string | null;
  status: "DRAFT" | "OPEN" | "READY_FOR_QUOTATION" | "NEEDS_CORRECTION";
  branchId: string;
  branch: { id: string; name: string };
  organizationId: string;
  organization: { id: string; name: string };
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  shipmentType: "IMPORT" | "EXPORT" | null;
  serviceTypes: ServiceTypeValue[];
  rfqReason: string | null;
  doer: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
  reviewNote: string | null;
  createdAt: string | Date;
  freightDetail: FreightDetailRaw | null;
  customsDetail: CustomsDetailRaw | null;
  transportDetail: TransportDetailRaw | null;
}

function toFreightState(raw: FreightDetailRaw | null): FreightDetailState {
  if (!raw) return EMPTY_FREIGHT_DETAIL;
  return {
    incoterm: raw.incoterm ?? "",
    portOfLoading: raw.portOfLoading ?? "",
    portOfDischarge: raw.portOfDischarge ?? "",
    cargoMode: raw.cargoMode ?? "",
    packageCount: raw.packageCount,
    dimensions: raw.dimensions ?? "",
    weight: raw.weight,
    fclWeight: raw.fclWeight,
    containerType: raw.containerType ?? "",
    containerCount: raw.containerCount,
    isOdc: raw.isOdc,
    odcDimensions: raw.odcDimensions ?? "",
    odcPackageCount: raw.odcPackageCount,
    odcPerPackageWeight: raw.odcPerPackageWeight,
  };
}

function toCustomsState(raw: CustomsDetailRaw | null): CustomsDetailState {
  if (!raw) return EMPTY_CUSTOMS_DETAIL;
  return { hsCode: raw.hsCode ?? "", commodity: raw.commodity ?? "" };
}

function toTransportState(raw: TransportDetailRaw | null): TransportDetailState {
  if (!raw) return EMPTY_TRANSPORT_DETAIL;
  return {
    pickup: raw.pickup ?? "",
    destination: raw.destination ?? "",
    cargoMode: raw.cargoMode ?? "",
    packageCount: raw.packageCount,
    dimensions: raw.dimensions ?? "",
    weight: raw.weight,
    fclWeight: raw.fclWeight,
    containerType: raw.containerType ?? "",
    deliveryType: raw.deliveryType ?? "",
    isOdc: raw.isOdc,
    odcDimensions: raw.odcDimensions ?? "",
    odcPackageCount: raw.odcPackageCount,
    odcPerPackageWeight: raw.odcPerPackageWeight,
  };
}

interface FormState {
  branchId: string;
  organizationId: string;
  organizationName: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  shipmentType: "" | "IMPORT" | "EXPORT";
  serviceTypes: ServiceTypeValue[];
  rfqReason: string;
  freightDetail: FreightDetailState;
  customsDetail: CustomsDetailState;
  transportDetail: TransportDetailState;
}

function buildInitialState(enquiry: EnquiryDetail): FormState {
  return {
    branchId: enquiry.branchId,
    organizationId: enquiry.organizationId,
    organizationName: enquiry.organization.name,
    contactPersonName: enquiry.contactPersonName ?? "",
    contactPersonPhone: enquiry.contactPersonPhone ?? "",
    contactPersonEmail: enquiry.contactPersonEmail ?? "",
    shipmentType: enquiry.shipmentType ?? "",
    serviceTypes: enquiry.serviceTypes,
    rfqReason: enquiry.rfqReason ?? "",
    freightDetail: toFreightState(enquiry.freightDetail),
    customsDetail: toCustomsState(enquiry.customsDetail),
    transportDetail: toTransportState(enquiry.transportDetail),
  };
}

function toAutosavePayload(form: FormState) {
  return {
    branchId: form.branchId || undefined,
    organizationId: form.organizationId || undefined,
    contactPersonName: form.contactPersonName || null,
    contactPersonPhone: form.contactPersonPhone || null,
    contactPersonEmail: form.contactPersonEmail || null,
    shipmentType: form.shipmentType || null,
    serviceTypes: form.serviceTypes,
    rfqReason: form.rfqReason || null,
    freightDetail: { ...form.freightDetail, cargoMode: form.freightDetail.cargoMode || null },
    customsDetail: form.customsDetail,
    transportDetail: {
      ...form.transportDetail,
      cargoMode: form.transportDetail.cargoMode || null,
      deliveryType: form.transportDetail.deliveryType || null,
    },
  };
}

interface EnquiryFormProps {
  enquiry: EnquiryDetail;
  branches: Branch[];
  role: Role;
  canEdit: boolean;
  canApprove: boolean;
}

export function EnquiryForm({ enquiry, branches, role, canEdit, canApprove }: EnquiryFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(enquiry));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const editable = canEdit && (enquiry.status === "DRAFT" || enquiry.status === "NEEDS_CORRECTION" || role === "ADMIN");

  async function saveDraft(value: FormState) {
    const res = await fetch(`/api/enquiries/${enquiry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toAutosavePayload(value)),
    });
    if (!res.ok) throw new Error("Autosave failed");
  }

  const { status: autosaveStatus } = useAutosave(form, saveDraft, { enabled: editable });

  const reference = useMemo(() => formatEnquiryRef(enquiry), [enquiry]);

  function toggleServiceType(value: ServiceTypeValue) {
    setForm((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(value)
        ? prev.serviceTypes.filter((v) => v !== value)
        : [...prev.serviceTypes, value],
    }));
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

    const res = await fetch(`/api/enquiries/${enquiry.id}/submit`, { method: "PATCH" });
    const body = await res.json();
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
    const res = await fetch(`/api/enquiries/${enquiry.id}/review`, {
      method: "PATCH",
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{reference}</h1>
          <p className="text-sm text-text-secondary">Doer: {enquiry.doer.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {editable && (
            <span className="text-xs text-text-tertiary">
              {autosaveStatus === "saving" && "Saving..."}
              {autosaveStatus === "saved" && "Saved"}
              {autosaveStatus === "error" && "Save failed"}
            </span>
          )}
          <Badge variant={enquiry.status === "READY_FOR_QUOTATION" ? "success" : enquiry.status === "NEEDS_CORRECTION" ? "danger" : "active"}>
            {enquiry.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {enquiry.status === "NEEDS_CORRECTION" && enquiry.reviewNote && (
        <Card className="mb-4 border-status-danger-fg/30 bg-status-danger-bg">
          <p className="text-sm font-medium text-status-danger-fg">Flagged back for correction:</p>
          <p className="mt-1 text-sm text-status-danger-fg">{enquiry.reviewNote}</p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Branch"
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            disabled={!editable}
          />
          <CustomerCombobox
            value={form.organizationId}
            displayValue={form.organizationName}
            branches={branches}
            onSelect={(org: CustomerOption) =>
              setForm({
                ...form,
                organizationId: org.id,
                organizationName: org.name,
                contactPersonName: org.contactPersonName ?? "",
                contactPersonPhone: org.contactPersonPhone ?? "",
                contactPersonEmail: org.contactPersonEmail ?? "",
              })
            }
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Input
            label="Contact Person Name"
            value={form.contactPersonName}
            onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })}
            disabled={!editable}
          />
          <Input
            label="Mobile No."
            value={form.contactPersonPhone}
            onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })}
            disabled={!editable}
          />
          <Input
            label="Email Id"
            type="email"
            value={form.contactPersonEmail}
            onChange={(e) => setForm({ ...form, contactPersonEmail: e.target.value })}
            disabled={!editable}
          />
        </div>
        <div className="mt-3">
          <Select
            label="Shipment Type"
            placeholder="Select..."
            value={form.shipmentType}
            onChange={(e) => setForm({ ...form, shipmentType: e.target.value as FormState["shipmentType"] })}
            options={[...SHIPMENT_TYPE_OPTIONS]}
            disabled={!editable}
          />
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-sm font-medium text-text-primary">Type of Services</span>
          <div className="flex flex-wrap gap-4">
            {SERVICE_TYPE_OPTIONS.map((opt) => (
              <Checkbox
                key={opt.value}
                label={opt.label}
                checked={form.serviceTypes.includes(opt.value)}
                onChange={() => toggleServiceType(opt.value)}
                disabled={!editable}
              />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Textarea
            label="Reason for Quote (RFQ)"
            value={form.rfqReason}
            onChange={(e) => setForm({ ...form, rfqReason: e.target.value })}
            rows={3}
            disabled={!editable}
          />
        </div>
      </Card>

      {form.serviceTypes.includes("FREIGHT_FORWARDING") && (
        <div className="mb-4">
          <FreightForwardingFields
            value={form.freightDetail}
            onChange={(freightDetail) => setForm({ ...form, freightDetail })}
            disabled={!editable}
          />
        </div>
      )}
      {form.serviceTypes.includes("CUSTOMS_CLEARANCE") && (
        <div className="mb-4">
          <CustomsClearanceFields
            value={form.customsDetail}
            onChange={(customsDetail) => setForm({ ...form, customsDetail })}
            disabled={!editable}
          />
        </div>
      )}
      {form.serviceTypes.includes("TRANSPORTATION") && (
        <div className="mb-4">
          <TransportationFields
            value={form.transportDetail}
            onChange={(transportDetail) => setForm({ ...form, transportDetail })}
            disabled={!editable}
          />
        </div>
      )}

      {submitError && <p className="mb-3 text-sm text-status-danger-fg">{submitError}</p>}
      {reviewError && <p className="mb-3 text-sm text-status-danger-fg">{reviewError}</p>}

      <div className="flex justify-end gap-2">
        {editable && (
          <Button onClick={handleSubmit} disabled={submitting || autosaveStatus === "saving"}>
            {submitting ? "Submitting..." : "Submit Enquiry"}
          </Button>
        )}
        {canApprove && enquiry.status === "OPEN" && (
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
