"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { SERVICE_TYPE_OPTIONS, SHIPMENT_TYPE_OPTIONS, formatEnquiryRef } from "@/lib/validation/enquiry";
import type { FieldConfigMap } from "@/lib/enquiries/field-config-keys";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { CustomerCombobox, type CustomerOption } from "@/components/shared/CustomerCombobox";
import { FreightForwardingFields, EMPTY_FREIGHT_DETAIL, type FreightDetailState, type PortOption } from "./FreightForwardingFields";
import { CustomsClearanceFields, EMPTY_CUSTOMS_DETAIL, type CustomsDetailState } from "./CustomsClearanceFields";
import { TransportationFields, EMPTY_TRANSPORT_DETAIL, type TransportDetailState } from "./TransportationFields";

type ServiceTypeValue = (typeof SERVICE_TYPE_OPTIONS)[number]["value"];

interface Branch {
  id: string;
  name: string;
}

interface FreightPackageRaw {
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "MM" | "CM" | null;
  weight: number | null;
  containerType: string | null;
}

interface FreightDetailRaw {
  incoterm: string | null;
  portOfLoadingId: string | null;
  portOfDischargeId: string | null;
  finalDestinationAddress: string | null;
  cargoMode: "LCL_AIR" | "FCL" | null;
  isOdc: boolean;
  odcDimensions: string | null;
  odcPackageCount: number | null;
  odcPerPackageWeight: number | null;
  packages: FreightPackageRaw[];
}

interface CommodityLineRaw {
  hsCode: string | null;
  commodity: string | null;
}

interface CustomsDetailRaw {
  commodityLines: CommodityLineRaw[];
}

interface TransportDetailRaw {
  pickup: string | null;
  destination: string | null;
  cargoMode: "LCL_AIR" | "FCL" | null;
  packageCount: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "MM" | "CM" | null;
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
    portOfLoadingId: raw.portOfLoadingId ?? "",
    portOfDischargeId: raw.portOfDischargeId ?? "",
    finalDestinationAddress: raw.finalDestinationAddress ?? "",
    cargoMode: raw.cargoMode ?? "",
    packages: raw.packages.map((p) => ({
      length: p.length,
      width: p.width,
      height: p.height,
      dimensionUnit: p.dimensionUnit ?? "",
      weight: p.weight,
      containerType: p.containerType ?? "",
    })),
    isOdc: raw.isOdc,
    odcDimensions: raw.odcDimensions ?? "",
    odcPackageCount: raw.odcPackageCount,
    odcPerPackageWeight: raw.odcPerPackageWeight,
  };
}

function toCustomsState(raw: CustomsDetailRaw | null): CustomsDetailState {
  if (!raw || raw.commodityLines.length === 0) return EMPTY_CUSTOMS_DETAIL;
  return { commodityLines: raw.commodityLines.map((l) => ({ hsCode: l.hsCode ?? "", commodity: l.commodity ?? "" })) };
}

function toTransportState(raw: TransportDetailRaw | null): TransportDetailState {
  if (!raw) return EMPTY_TRANSPORT_DETAIL;
  return {
    pickup: raw.pickup ?? "",
    destination: raw.destination ?? "",
    cargoMode: raw.cargoMode ?? "",
    packageCount: raw.packageCount,
    length: raw.length,
    width: raw.width,
    height: raw.height,
    dimensionUnit: raw.dimensionUnit ?? "",
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
    freightDetail: {
      incoterm: form.freightDetail.incoterm || null,
      portOfLoadingId: form.freightDetail.portOfLoadingId || null,
      portOfDischargeId: form.freightDetail.portOfDischargeId || null,
      finalDestinationAddress: form.freightDetail.finalDestinationAddress || null,
      cargoMode: form.freightDetail.cargoMode || null,
      packages: form.freightDetail.packages.map((p) => ({
        length: p.length,
        width: p.width,
        height: p.height,
        dimensionUnit: p.dimensionUnit || null,
        weight: p.weight,
        containerType: p.containerType || null,
      })),
      isOdc: form.freightDetail.isOdc,
      odcDimensions: form.freightDetail.odcDimensions || null,
      odcPackageCount: form.freightDetail.odcPackageCount,
      odcPerPackageWeight: form.freightDetail.odcPerPackageWeight,
    },
    customsDetail: {
      commodityLines: form.customsDetail.commodityLines.map((l) => ({
        hsCode: l.hsCode || null,
        commodity: l.commodity || null,
      })),
    },
    transportDetail: {
      ...form.transportDetail,
      cargoMode: form.transportDetail.cargoMode || null,
      dimensionUnit: form.transportDetail.dimensionUnit || null,
      deliveryType: form.transportDetail.deliveryType || null,
    },
  };
}

interface EnquiryFormProps {
  enquiry: EnquiryDetail;
  branches: Branch[];
  ports: PortOption[];
  // Admin-configured field visibility/requiredness per service type (Stage
  // 12c "RFQ formatting") — merged map, already defaulted for every known
  // field key server-side.
  fieldConfig: FieldConfigMap;
  canEdit: boolean;
  // True once this enquiry has been bundled into a Quotation — locked from
  // further edits at that point so the quote and its source RFQ can't drift.
  isLocked: boolean;
}

const UNSUBMITTED_STATUSES = ["DRAFT", "NEEDS_CORRECTION"] as const;

export function EnquiryForm({ enquiry, branches, ports, fieldConfig, canEdit, isLocked }: EnquiryFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(enquiry));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  const editable = canEdit && !isLocked;
  const unsubmitted = (UNSUBMITTED_STATUSES as readonly string[]).includes(enquiry.status);

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

    const res = await fetch(`/api/enquiries/${enquiry.id}/submit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toAutosavePayload(form)),
    });
    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      const issues = (body.issues as { message: string }[] | undefined)?.map((i) => i.message).join("; ");
      setSubmitError(issues || body.error || "Submission failed");
      return;
    }

    toast.success("Enquiry submitted — ready for quotation");
    router.push("/enquiries");
  }

  async function handleSaveAndClose() {
    setSaving(true);
    setSubmitError(null);
    try {
      await saveDraft(form);
    } catch {
      setSaving(false);
      setSubmitError("Failed to save changes");
      return;
    }
    setSaving(false);
    toast.success("Changes saved");
    router.push("/enquiries");
  }

  function handleBack() {
    router.back();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
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
            ports={ports}
            fieldConfig={fieldConfig.FREIGHT_FORWARDING}
          />
        </div>
      )}
      {form.serviceTypes.includes("CUSTOMS_CLEARANCE") && (
        <div className="mb-4">
          <CustomsClearanceFields
            value={form.customsDetail}
            onChange={(customsDetail) => setForm({ ...form, customsDetail })}
            disabled={!editable}
            fieldConfig={fieldConfig.CUSTOMS_CLEARANCE}
          />
        </div>
      )}
      {form.serviceTypes.includes("TRANSPORTATION") && (
        <div className="mb-4">
          <TransportationFields
            value={form.transportDetail}
            onChange={(transportDetail) => setForm({ ...form, transportDetail })}
            disabled={!editable}
            fieldConfig={fieldConfig.TRANSPORTATION}
          />
        </div>
      )}

      {submitError && <p className="mb-3 text-sm text-status-danger-fg">{submitError}</p>}

      <div className="flex justify-end gap-2">
        {editable && !unsubmitted && (
          <>
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleSaveAndClose} disabled={saving || autosaveStatus === "saving"}>
              {saving ? "Saving..." : "Save & Close"}
            </Button>
          </>
        )}
        {editable && unsubmitted && (
          <Button onClick={handleSubmit} disabled={submitting || autosaveStatus === "saving"}>
            {submitting ? "Submitting..." : "Submit Enquiry"}
          </Button>
        )}
      </div>
    </div>
  );
}
