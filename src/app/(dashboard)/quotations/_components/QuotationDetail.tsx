"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { formatQuotationRef, type QuotationLineItemInput } from "@/lib/validation/quotation";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { LineItemsEditor } from "./LineItemsEditor";
import { ReviewModal } from "./ReviewModal";
import { QuotationHtmlPreview } from "@/components/quotations/QuotationHtmlPreview";
import type { QuotationPdfData } from "@/lib/pdf/types";

type QuotationStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "NEEDS_CORRECTION"
  | "APPROVED"
  | "SENT"
  | "CUSTOMER_APPROVED"
  | "CONVERTED";

const STATUS_BADGE_VARIANT: Record<QuotationStatus, "pending" | "active" | "danger" | "success" | "neutral"> = {
  DRAFT: "pending",
  PENDING_APPROVAL: "active",
  NEEDS_CORRECTION: "danger",
  APPROVED: "success",
  SENT: "success",
  CUSTOMER_APPROVED: "success",
  CONVERTED: "neutral",
};

// Line items stay editable in every status except while a Branch Manager
// review is pending, or once the quotation is fully converted — an edit made
// after approval clones a new version server-side rather than being blocked.
const LINE_ITEMS_LOCKED_STATUSES: QuotationStatus[] = ["PENDING_APPROVAL", "CONVERTED"];

interface EnquirySummary {
  id: string;
  sequenceNumber: number;
  createdAt: string | Date;
  shipmentType: string | null;
  serviceTypes: string[];
}

interface VersionSummary {
  id: string;
  versionNumber: number;
  currency: string;
  totalAmount: number;
  createdAt: string | Date;
  createdBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | Date | null;
}

interface QuotationDetailProps {
  quotation: {
    id: string;
    sequenceNumber: number;
    status: QuotationStatus;
    createdAt: string | Date;
    currentVersionNumber: number;
    reviewNote: string | null;
    reviewedBy: { id: string; name: string } | null;
    reviewedAt: string | Date | null;
    sentAt: string | Date | null;
    customerApprovedNote: string | null;
    customerApprovedBy: { id: string; name: string } | null;
    customerApprovedAt: string | Date | null;
    convertedAt: string | Date | null;
    organization: { id: string; name: string };
    branch: { id: string; name: string };
    createdBy: { id: string; name: string };
    versions: VersionSummary[];
    enquiries: { id: string; enquiry: EnquirySummary }[];
  };
  currentVersion: { id: string; versionNumber: number; currency: string; totalAmount: number };
  lineItems: QuotationLineItemInput[];
  canEdit: boolean;
  canApprove: boolean;
}

export function QuotationDetail({ quotation, currentVersion, lineItems, canEdit, canApprove }: QuotationDetailProps) {
  const router = useRouter();
  const [items, setItems] = useState<QuotationLineItemInput[]>(lineItems);
  const [currency, setCurrency] = useState(currentVersion.currency);
  const [flagBackOpen, setFlagBackOpen] = useState(false);
  const [customerNoteOpen, setCustomerNoteOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<QuotationPdfData | null>(null);

  const editable = canEdit && !LINE_ITEMS_LOCKED_STATUSES.includes(quotation.status);

  const { status: saveStatus } = useAutosave(
    { currency, items: items.map((item, index) => ({ ...item, currency, sortOrder: index })) },
    async (value) => {
      const res = await fetch(`/api/quotations/${quotation.id}/line-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: value.currency, lineItems: value.items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      router.refresh();
    },
    { enabled: editable },
  );

  async function runAction(path: string, body?: unknown) {
    setActionError(null);
    const res = await fetch(`/api/quotations/${quotation.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      setActionError(responseBody.error ?? "Action failed");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handlePdfDownload() {
    setActionError(null);
    const res = await fetch(`/api/quotations/${quotation.id}/pdf`);
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      return;
    }
    const body = await res.json().catch(() => null);
    if (body?.fallback) {
      setPdfPreview(body.data as QuotationPdfData);
      return;
    }
    setActionError("PDF generation failed and no preview data was returned.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {formatQuotationRef(quotation.createdAt, quotation.sequenceNumber)}
          </h1>
          <p className="text-sm text-text-secondary">
            {quotation.organization.name} · {quotation.branch.name} · Version {quotation.currentVersionNumber}
          </p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[quotation.status]}>{quotation.status.replace(/_/g, " ")}</Badge>
      </div>

      {actionError && <p className="text-sm text-status-danger-fg">{actionError}</p>}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">Enquiries Covered</h2>
        <ul className="text-sm text-text-primary">
          {quotation.enquiries.map((qe) => (
            <li key={qe.id}>
              {formatEnquiryRef(qe.enquiry.createdAt, qe.enquiry.sequenceNumber)} — {qe.enquiry.shipmentType ?? "—"} (
              {qe.enquiry.serviceTypes.join(", ") || "—"})
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Charges</h2>
          {editable && (
            <span className="text-xs text-text-tertiary">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : ""}
            </span>
          )}
        </div>
        <LineItemsEditor
          items={items}
          onChange={setItems}
          currency={currency}
          onCurrencyChange={setCurrency}
          readOnly={!editable}
        />
      </Card>

      <Card className="flex flex-wrap items-center gap-2">
        {canEdit && (quotation.status === "DRAFT" || quotation.status === "NEEDS_CORRECTION") && (
          <Button onClick={() => runAction("submit")}>Submit for Review</Button>
        )}
        {canApprove && quotation.status === "PENDING_APPROVAL" && (
          <>
            <Button variant="ghost" onClick={() => setFlagBackOpen(true)}>
              Flag Back
            </Button>
            <Button onClick={() => runAction("review", { decision: "approve" })}>Approve</Button>
          </>
        )}
        {canEdit && quotation.status === "APPROVED" && <Button onClick={() => runAction("send")}>Mark Sent</Button>}
        {canEdit && quotation.status === "SENT" && !customerNoteOpen && (
          <Button onClick={() => setCustomerNoteOpen(true)}>Record Customer Approval</Button>
        )}
        {canEdit && quotation.status === "CUSTOMER_APPROVED" && (
          <Button onClick={() => runAction("convert")}>Convert to Job(s)</Button>
        )}
        <Button variant="ghost" onClick={handlePdfDownload}>
          Download PDF
        </Button>
      </Card>

      {customerNoteOpen && (
        <Card className="flex flex-col gap-3">
          <Textarea
            label="Customer approval note (optional)"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCustomerNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const ok = await runAction("customer-approval", { note: customerNote || undefined });
                if (ok) {
                  setCustomerNoteOpen(false);
                  setCustomerNote("");
                }
              }}
            >
              Confirm Customer Approval
            </Button>
          </div>
        </Card>
      )}

      {quotation.reviewNote && (
        <Card>
          <p className="text-xs uppercase text-text-tertiary">Latest Review Note</p>
          <p className="text-sm text-text-primary">{quotation.reviewNote}</p>
          {quotation.reviewedBy && (
            <p className="text-xs text-text-tertiary">
              — {quotation.reviewedBy.name}, {quotation.reviewedAt && new Date(quotation.reviewedAt).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">Version History</h2>
        <div className="flex flex-col gap-2 text-sm">
          {quotation.versions.map((v) => (
            <div key={v.id} className="flex justify-between border-b border-border-subtle pb-1 last:border-0">
              <span>
                v{v.versionNumber} — {v.createdBy.name}, {new Date(v.createdAt).toLocaleDateString()}
              </span>
              <span className="text-text-secondary">
                {v.currency} {v.totalAmount.toFixed(2)}
                {v.approvedBy ? ` · Approved by ${v.approvedBy.name}` : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <ReviewModal
        open={flagBackOpen}
        onClose={() => setFlagBackOpen(false)}
        onSubmit={async (note) => {
          const res = await fetch(`/api/quotations/${quotation.id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "needs_correction", note }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Flag back failed");
          }
          setFlagBackOpen(false);
          router.refresh();
        }}
      />

      {pdfPreview && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              PDF generation is unavailable right now — showing an HTML preview instead.
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setPdfPreview(null)}>
              Close
            </Button>
          </div>
          <QuotationHtmlPreview data={pdfPreview} />
        </div>
      )}
    </div>
  );
}
