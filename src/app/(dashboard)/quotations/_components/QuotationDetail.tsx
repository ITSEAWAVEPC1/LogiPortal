"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { formatQuotationRef, type QuotationLineItemInput } from "@/lib/validation/quotation";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { LineItemsEditor } from "./LineItemsEditor";
import { ReviewModal } from "./ReviewModal";
import { QuotationHtmlPreview } from "@/components/quotations/QuotationHtmlPreview";
import type { QuotationPdfData } from "@/lib/pdf/types";

type ChargeCategory = QuotationLineItemInput["category"];

// Maps an Enquiry's serviceTypes to the charge categories its Quotation
// should offer by default — Reimbursement is always available as a general
// catch-all regardless of service type.
const SERVICE_TYPE_TO_CATEGORY: Record<string, ChargeCategory> = {
  FREIGHT_FORWARDING: "FREIGHT",
  CUSTOMS_CLEARANCE: "CUSTOMS_CLEARANCE",
  TRANSPORTATION: "TRANSPORTATION",
};

function availableCategoriesFor(serviceTypes: string[]): ChargeCategory[] {
  const mapped = serviceTypes.map((s) => SERVICE_TYPE_TO_CATEGORY[s]).filter((c): c is ChargeCategory => Boolean(c));
  return Array.from(new Set([...mapped, "REIMBURSEMENT" as ChargeCategory]));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

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
  referenceNo: string | null;
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
    referenceNo: string | null;
    sourceReference: string | null;
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
  lineItems: QuotationLineItemInput[];
  canEdit: boolean;
  canApprove: boolean;
}

export function QuotationDetail({ quotation, lineItems, canEdit, canApprove }: QuotationDetailProps) {
  const router = useRouter();
  const [items, setItems] = useState<QuotationLineItemInput[]>(lineItems);
  const [flagBackOpen, setFlagBackOpen] = useState(false);
  const [customerNoteOpen, setCustomerNoteOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<QuotationPdfData | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [versionLineItems, setVersionLineItems] = useState<Record<number, QuotationLineItemInput[]>>({});
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);

  const editable = canEdit && !LINE_ITEMS_LOCKED_STATUSES.includes(quotation.status);
  const availableCategories = availableCategoriesFor(quotation.enquiries.flatMap((qe) => qe.enquiry.serviceTypes));

  const { status: saveStatus } = useAutosave(
    { items: items.map((item, index) => ({ ...item, sortOrder: index })) },
    async (value) => {
      const res = await fetch(`/api/quotations/${quotation.id}/line-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: value.items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      router.refresh();
    },
    { enabled: editable },
  );

  async function toggleVersionHistory(versionNumber: number) {
    if (expandedVersion === versionNumber) {
      setExpandedVersion(null);
      return;
    }
    setExpandedVersion(versionNumber);
    if (versionLineItems[versionNumber]) return;
    setLoadingVersion(versionNumber);
    const res = await fetch(`/api/quotations/${quotation.id}/versions/${versionNumber}/line-items`);
    const body = await res.json().catch(() => ({}));
    setVersionLineItems((prev) => ({ ...prev, [versionNumber]: body.lineItems ?? [] }));
    setLoadingVersion(null);
  }

  async function handleCopyForEmail() {
    const rows = items
      .map(
        (item, i) => `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${item.currency}</td>
          <td>${item.quantity ?? ""}</td>
          <td>${item.rate ?? ""}</td>
          <td>${item.rateInr ?? ""}</td>
          <td>${escapeHtml(item.remarks ?? "")}</td>
          <td>${item.amount.toFixed(2)}</td>
        </tr>`,
      )
      .join("");
    const html = `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse">
      <thead><tr>
        <th>Sr No</th><th>Particulars</th><th>Currency</th><th>Qty</th><th>Rate</th><th>Rate INR</th><th>Remarks</th><th>Amount (INR)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="7" style="text-align:right"><b>Total</b></td><td><b>INR ${items.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}</b></td></tr></tfoot>
    </table>`;
    const text = items
      .map(
        (item, i) =>
          `${i + 1}\t${item.description}\t${item.currency}\t${item.quantity ?? ""}\t${item.rate ?? ""}\t${item.rateInr ?? ""}\t${item.remarks ?? ""}\t${item.amount.toFixed(2)}`,
      )
      .join("\n");

    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.success("Copied — paste into your email body");
    } catch {
      setActionError("Could not copy to clipboard");
    }
  }

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
          <h1 className="text-2xl font-semibold text-text-primary">{formatQuotationRef(quotation)}</h1>
          <p className="text-sm text-text-secondary">
            {quotation.organization.name} · {quotation.branch.name} · Version {quotation.currentVersionNumber}
            {quotation.sourceReference && ` · also covers ${quotation.sourceReference}`}
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
              {formatEnquiryRef(qe.enquiry)} — {qe.enquiry.shipmentType ?? "—"} (
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
        <LineItemsEditor items={items} onChange={setItems} readOnly={!editable} availableCategories={availableCategories} />
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
        <Button variant="ghost" onClick={handleCopyForEmail}>
          Copy for Email
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
            <div key={v.id} className="border-b border-border-subtle pb-2 last:border-0">
              <button
                type="button"
                onClick={() => toggleVersionHistory(v.versionNumber)}
                className="flex w-full justify-between py-1 text-left"
              >
                <span>
                  v{v.versionNumber} — {v.createdBy.name}, {new Date(v.createdAt).toLocaleDateString()}
                </span>
                <span className="text-text-secondary">
                  {v.currency} {v.totalAmount.toFixed(2)}
                  {v.approvedBy ? ` · Approved by ${v.approvedBy.name}` : ""}
                  {" · "}
                  {expandedVersion === v.versionNumber ? "Hide" : "View"} line items
                </span>
              </button>
              {expandedVersion === v.versionNumber && (
                <div className="mt-2 rounded-md bg-bg-offwhite p-2">
                  {loadingVersion === v.versionNumber ? (
                    <p className="text-xs text-text-tertiary">Loading...</p>
                  ) : (
                    <LineItemsEditor
                      items={versionLineItems[v.versionNumber] ?? []}
                      onChange={() => {}}
                      readOnly
                    />
                  )}
                </div>
              )}
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
