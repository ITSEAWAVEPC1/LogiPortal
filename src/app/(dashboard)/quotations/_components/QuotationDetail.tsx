"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, StepTracker, type Step } from "@/components/ui";
import { formatEnquiryRef } from "@/lib/validation/enquiry";
import { QUOTATION_CHARGE_CATEGORY_OPTIONS, formatQuotationRef, type QuotationLineItemInput } from "@/lib/validation/quotation";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { LineItemsEditor } from "./LineItemsEditor";
import { CostSheetEditor, type CostSheetState } from "./CostSheetEditor";
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
  // Stage 14b pipeline
  | "FLOATED"
  | "COST_WORKING"
  | "QUOTATION_PREPARED"
  | "APPROVED"
  | "CONVERTED"
  // legacy (pre-14b)
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "NEEDS_CORRECTION"
  | "SENT"
  | "CUSTOMER_APPROVED";

const STATUS_BADGE_VARIANT: Record<QuotationStatus, "pending" | "active" | "danger" | "success" | "neutral"> = {
  FLOATED: "pending",
  COST_WORKING: "active",
  QUOTATION_PREPARED: "active",
  APPROVED: "success",
  CONVERTED: "neutral",
  DRAFT: "pending",
  PENDING_APPROVAL: "active",
  NEEDS_CORRECTION: "danger",
  SENT: "success",
  CUSTOMER_APPROVED: "success",
};

// Steps for the pipeline tracker, in order. The current index is derived from
// status (legacy statuses map onto the nearest pipeline step).
const PIPELINE_STEPS = ["Float Enquiry", "Cost Working", "Quotation Prepared", "Approved", "Converted"] as const;

function pipelineIndex(status: QuotationStatus): number {
  switch (status) {
    case "FLOATED":
    case "DRAFT":
      return 0;
    case "COST_WORKING":
      return 1;
    case "QUOTATION_PREPARED":
    case "PENDING_APPROVAL":
    case "NEEDS_CORRECTION":
      return 2;
    case "APPROVED":
    case "SENT":
    case "CUSTOMER_APPROVED":
      return 3;
    case "CONVERTED":
      return 4;
    default:
      return 0;
  }
}

// Line items stay editable in every status except once the quotation is fully
// converted (or, for legacy rows, while a Branch Manager review is pending) —
// an edit made after approval clones a new version server-side.
const LINE_ITEMS_LOCKED_STATUSES: QuotationStatus[] = ["PENDING_APPROVAL", "CONVERTED"];

// The cost sheet is editable only while the quotation is still being worked up.
const COST_SHEET_EDITABLE_STATUSES: QuotationStatus[] = ["FLOATED", "COST_WORKING", "QUOTATION_PREPARED"];

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
  canViewCosts: boolean;
  canEditCosts: boolean;
  costSheet: CostSheetState;
  costSheetPreparedAt: string | Date | null;
}

export function QuotationDetail({
  quotation,
  lineItems,
  canEdit,
  canViewCosts,
  canEditCosts,
  costSheet,
  costSheetPreparedAt,
}: QuotationDetailProps) {
  const router = useRouter();
  const [items, setItems] = useState<QuotationLineItemInput[]>(lineItems);
  const [sheet, setSheet] = useState<CostSheetState>(costSheet);
  const [confirmPrepare, setConfirmPrepare] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<QuotationPdfData | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [versionLineItems, setVersionLineItems] = useState<Record<number, QuotationLineItemInput[]>>({});
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null);

  const editable = canEdit && !LINE_ITEMS_LOCKED_STATUSES.includes(quotation.status);
  const costSheetEditable = canEditCosts && COST_SHEET_EDITABLE_STATUSES.includes(quotation.status);
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

  const { status: costSaveStatus } = useAutosave(
    {
      defaultMarginPct: sheet.defaultMarginPct,
      notes: sheet.notes,
      costLines: sheet.costLines.map((line, index) => ({ ...line, sortOrder: index })),
    },
    async (value) => {
      const res = await fetch(`/api/quotations/${quotation.id}/cost-sheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Cost sheet save failed");
      }
      router.refresh();
    },
    { enabled: costSheetEditable },
  );

  async function handlePrepare() {
    if (costSheetPreparedAt && !confirmPrepare) {
      setConfirmPrepare(true);
      return;
    }
    setConfirmPrepare(false);
    setPreparing(true);
    setActionError(null);
    const res = await fetch(`/api/quotations/${quotation.id}/prepare`, { method: "POST" });
    setPreparing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Prepare failed");
      return;
    }
    toast.success("Quotation prepared from the cost sheet");
    router.refresh();
  }

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
    // Stage 14d — grouped by charge category (canonical order, non-empty only),
    // lettered a) b) c), items numbered 1. 2. within each section, full
    // columns (Particulars / Qty / Rate / Amount).
    const money = (n: number) =>
      `INR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const grandTotal = items.reduce((s, i) => s + (i.amount || 0), 0);

    const sections = QUOTATION_CHARGE_CATEGORY_OPTIONS.map(({ value, label }) => ({
      label,
      lines: items.filter((i) => i.category === value),
    })).filter((s) => s.lines.length > 0);

    const letter = (i: number) => String.fromCharCode(97 + i); // a, b, c, ...

    const textBlocks = sections.map((sec, si) => {
      const head = `${letter(si)}) ${sec.label}`;
      const lines = sec.lines.map((item, li) => {
        const qtyRate =
          item.quantity != null && item.rate != null ? `   ${item.quantity} x ${item.rate} = ` : "   ";
        return `   ${li + 1}. ${item.description}${qtyRate}${money(item.amount)}`;
      });
      return [head, ...lines].join("\n");
    });
    const text = `${textBlocks.join("\n\n")}\n\nTotal: ${money(grandTotal)}`;

    const htmlSections = sections
      .map((sec, si) => {
        const header = `<tr><td colspan="4" style="padding-top:8px"><b>${letter(si)}) ${escapeHtml(sec.label)}</b></td></tr>`;
        const lineRows = sec.lines
          .map(
            (item, li) => `<tr>
          <td style="padding:2px 8px">${li + 1}.</td>
          <td style="padding:2px 8px">${escapeHtml(item.description)}</td>
          <td style="padding:2px 8px;text-align:right">${item.quantity != null && item.rate != null ? `${item.quantity} x ${item.rate}` : ""}</td>
          <td style="padding:2px 8px;text-align:right">${money(item.amount)}</td>
        </tr>`,
          )
          .join("");
        return header + lineRows;
      })
      .join("");
    const html = `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
      <tbody>${htmlSections}</tbody>
      <tfoot><tr><td colspan="3" style="padding:8px 8px 2px;text-align:right"><b>Total</b></td><td style="padding:8px 8px 2px;text-align:right"><b>${money(grandTotal)}</b></td></tr></tfoot>
    </table>`;

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

      <Card>
        <StepTracker
          orientation="horizontal"
          steps={PIPELINE_STEPS.map((label, i): Step => {
            const idx = pipelineIndex(quotation.status);
            return { id: label, label, status: i < idx ? "completed" : i === idx ? "active" : "pending" };
          })}
        />
      </Card>

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

      {canViewCosts && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Cost Working</h2>
            <div className="flex items-center gap-3">
              {costSheetEditable && (
                <span className="text-xs text-text-tertiary">
                  {costSaveStatus === "saving"
                    ? "Saving..."
                    : costSaveStatus === "saved"
                      ? "Saved"
                      : costSaveStatus === "error"
                        ? "Save failed"
                        : ""}
                </span>
              )}
              {costSheetEditable && !confirmPrepare && (
                <Button size="sm" onClick={handlePrepare} disabled={preparing || sheet.costLines.length === 0}>
                  {preparing ? "Preparing..." : "Prepare Quotation"}
                </Button>
              )}
              {confirmPrepare && (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-status-danger-fg">Replaces all charge lines. Continue?</span>
                  <Button size="sm" onClick={handlePrepare} disabled={preparing}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmPrepare(false)}>
                    Cancel
                  </Button>
                </span>
              )}
            </div>
          </div>
          {costSheetPreparedAt && (
            <p className="mb-2 text-xs text-text-tertiary">
              Charges last generated from this cost sheet on {new Date(costSheetPreparedAt).toLocaleString("en-GB")}.
            </p>
          )}
          <CostSheetEditor
            value={sheet}
            onChange={setSheet}
            readOnly={!costSheetEditable}
            availableCategories={availableCategories}
          />
        </Card>
      )}

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
        {canEdit && quotation.status === "QUOTATION_PREPARED" && (
          <Button onClick={() => runAction("approve")}>Mark Approved</Button>
        )}
        {canEdit && quotation.status === "APPROVED" && (
          <Button onClick={() => runAction("convert")}>Convert to Job(s)</Button>
        )}
        <Button variant="ghost" onClick={handlePdfDownload}>
          Download PDF
        </Button>
        <Button variant="ghost" onClick={handleCopyForEmail}>
          Copy for Email
        </Button>
      </Card>

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
