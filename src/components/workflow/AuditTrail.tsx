"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { jobAuditActionLabel, jobAuditNote } from "@/lib/audit/labels";
import type { WorkflowAuditEntry } from "./types";

function describe(entry: WorkflowAuditEntry): string {
  const who = entry.actor?.name ?? "Someone";
  const what = jobAuditActionLabel(entry.action);
  const step = entry.stepKey && entry.action.startsWith("workflow.step.") ? ` "${entry.stepKey.replace(/_/g, " ")}"` : "";
  return `${who} ${what}${step}`;
}

function note(entry: WorkflowAuditEntry): string | null {
  return jobAuditNote(entry.detail);
}

export function AuditTrail({ entries }: { entries: WorkflowAuditEntry[] }) {
  const [open, setOpen] = useState(false);
  const ordered = [...entries].reverse(); // newest first

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wide text-text-secondary"
      >
        <span>Audit trail ({entries.length})</span>
        <span className="text-text-tertiary">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-2">
          {ordered.length === 0 && <li className="text-sm text-text-tertiary">No activity yet.</li>}
          {ordered.map((e) => (
            <li key={e.id} className="border-l-2 border-border-subtle pl-3 text-sm">
              <p className="text-text-primary">{describe(e)}</p>
              {note(e) && <p className="text-xs text-text-secondary">“{note(e)}”</p>}
              <p className="text-xs text-text-tertiary">{new Date(e.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
