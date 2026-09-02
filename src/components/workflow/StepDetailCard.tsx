"use client";

import { FormEvent, useState } from "react";
import { Button, Card, Input, Modal, Select, Textarea } from "@/components/ui";
import type { StepAction, WorkflowProgressStep } from "./types";

interface StepDetailCardProps {
  step: WorkflowProgressStep;
  viewerRole: string;
  busy: boolean;
  onAction: (action: StepAction, payload: { data?: Record<string, unknown>; note?: string }) => void;
}

function initialValues(step: WorkflowProgressStep): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of step.fields) {
    const v = step.data?.[f.key];
    out[f.key] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

function toDataPayload(step: WorkflowProgressStep, values: Record<string, string>) {
  const data: Record<string, unknown> = {};
  for (const f of step.fields) {
    const raw = values[f.key]?.trim() ?? "";
    if (raw === "") continue;
    data[f.key] = f.type === "number" ? Number(raw) : raw;
  }
  return data;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

// Parent passes key={step.id} so field state resets on selection change
// (no set-state-in-effect).
export function StepDetailCard({ step, viewerRole, busy, onAction }: StepDetailCardProps) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(step));
  const [notePrompt, setNotePrompt] = useState<null | "reject" | "revert" | "skip">(null);

  const isAdmin = viewerRole === "ADMIN";
  const isOwner = viewerRole === step.ownerRole;
  const isApprover = !!step.approverRole && viewerRole === step.approverRole;

  const ownerCanAct = (isOwner || isAdmin) && (step.status === "PENDING" || step.status === "IN_PROGRESS");
  const approverCanAct = (isApprover || isAdmin) && step.status === "PENDING_APPROVAL";
  const adminCanRevert = isAdmin && (step.status === "COMPLETED" || step.status === "SKIPPED");
  const editable = ownerCanAct;

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submitOwner(action: "save" | "complete" | "submit") {
    onAction(action, { data: toDataPayload(step, values) });
  }

  function handleNotePrompt(e: FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value.trim();
    if (!note && notePrompt !== "skip") return;
    if (notePrompt === "reject") onAction("reject", { note });
    if (notePrompt === "revert") onAction("revert", { note });
    if (notePrompt === "skip") onAction("skip", note ? { note } : {});
    setNotePrompt(null);
  }

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{step.label}</h3>
          <p className="text-xs text-text-secondary">
            Owner: {step.ownerRole.replace(/_/g, " ")}
            {step.isApprovalGate && step.approverRole && ` · Approver: ${step.approverRole.replace(/_/g, " ")}`}
          </p>
        </div>
        <span className="rounded bg-border-subtle/60 px-2 py-0.5 text-[11px] font-medium text-text-secondary">
          {step.status.replace(/_/g, " ")}
        </span>
      </div>

      {step.status === "IN_PROGRESS" && step.reviewNote && (
        <div className="mb-3 rounded-md border border-status-danger-fg/30 bg-status-danger-bg p-2 text-sm text-status-danger-fg">
          <span className="font-medium">Returned for changes:</span> {step.reviewNote}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {step.fields.map((f) =>
          f.key === "note" ? (
            <Textarea
              key={f.key}
              label={f.label}
              rows={2}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={!editable}
            />
          ) : f.type === "select" ? (
            <Select
              key={f.key}
              label={f.label + (f.required ? " *" : "")}
              placeholder="Select..."
              options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={!editable}
            />
          ) : (
            <Input
              key={f.key}
              label={f.label + (f.required ? " *" : "")}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={!editable}
            />
          ),
        )}
      </div>

      {(step.completedAt || step.approvedAt) && (
        <p className="mt-3 text-xs text-text-tertiary">
          {step.approvedBy
            ? `Approved by ${step.approvedBy.name} · ${fmtDateTime(step.approvedAt)}`
            : step.completedBy
              ? `Completed by ${step.completedBy.name} · ${fmtDateTime(step.completedAt)}`
              : null}
        </p>
      )}

      {step.status === "PENDING_APPROVAL" && !approverCanAct && (
        <p className="mt-3 text-xs text-text-secondary">
          Awaiting {step.approverRole?.replace(/_/g, " ")} approval.
        </p>
      )}

      {(ownerCanAct || approverCanAct || adminCanRevert) && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {ownerCanAct && (
            <>
              {step.isSkippable && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setNotePrompt("skip")}>
                  Skip step
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => submitOwner("save")}>
                Save draft
              </Button>
              {step.isApprovalGate ? (
                <Button size="sm" disabled={busy} onClick={() => submitOwner("submit")}>
                  Submit for approval
                </Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => submitOwner("complete")}>
                  Mark complete
                </Button>
              )}
            </>
          )}
          {approverCanAct && (
            <>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => setNotePrompt("reject")}>
                Reject
              </Button>
              <Button size="sm" disabled={busy} onClick={() => onAction("approve", {})}>
                Approve
              </Button>
            </>
          )}
          {adminCanRevert && (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => setNotePrompt("revert")}>
              Revert step
            </Button>
          )}
        </div>
      )}

      <Modal
        open={notePrompt !== null}
        onClose={() => setNotePrompt(null)}
        title={notePrompt === "revert" ? "Revert this step" : notePrompt === "skip" ? "Skip this step" : "Reject this step"}
      >
        <form onSubmit={handleNotePrompt} className="flex flex-col gap-3">
          <Textarea
            name="note"
            label="Reason"
            required={notePrompt !== "skip"}
            rows={4}
            placeholder={
              notePrompt === "revert"
                ? "Why is this completed step being reopened? Later steps will reset to pending."
                : notePrompt === "skip"
                  ? "Optional — why is this step not required for this shipment?"
                  : "What needs to change before this can be approved?"
            }
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNotePrompt(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={notePrompt === "skip" ? "primary" : "danger"} disabled={busy}>
              {notePrompt === "revert" ? "Revert" : notePrompt === "skip" ? "Skip" : "Reject"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
