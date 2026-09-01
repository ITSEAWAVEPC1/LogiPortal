"use client";

import { cn } from "@/lib/utils/cn";
import type { WorkflowProgressStep, WorkflowStepStatus } from "./types";

interface WorkflowRailProps {
  steps: WorkflowProgressStep[];
  selectedId: string | null;
  currentStepId: string | null;
  onSelect: (id: string) => void;
}

// Teal = completed, Plum = active/awaiting, Gray = pending — Section 2.1's
// rule, same palette as the shared StepTracker primitive (this is the
// interactive workflow variant, not a replacement for it).
function dotClass(status: WorkflowStepStatus) {
  switch (status) {
    case "COMPLETED":
      return "bg-brand-teal text-white";
    case "IN_PROGRESS":
    case "PENDING_APPROVAL":
      return "bg-brand-plum text-white";
    default:
      return "bg-border-subtle text-text-secondary";
  }
}

function statusLabel(status: WorkflowStepStatus) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "IN_PROGRESS":
      return "In progress";
    case "PENDING_APPROVAL":
      return "Awaiting approval";
    case "SKIPPED":
      return "Skipped";
    default:
      return "Pending";
  }
}

export function WorkflowRail({ steps, selectedId, currentStepId, onSelect }: WorkflowRailProps) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const selected = step.id === selectedId;
        const isCurrent = step.id === currentStepId;
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  dotClass(step.status),
                )}
              >
                {step.status === "COMPLETED" ? "✓" : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "w-0.5 flex-1",
                    step.status === "COMPLETED" ? "bg-brand-teal" : "bg-border-subtle",
                  )}
                  style={{ minHeight: "1.25rem" }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              className={cn(
                "mb-2 flex-1 rounded-md border px-3 py-2 text-left transition-colors",
                selected ? "border-brand-teal bg-brand-teal/5" : "border-transparent hover:border-border-subtle",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{step.label}</span>
                {step.isApprovalGate && (
                  <span className="rounded bg-brand-plum/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-plum">
                    Gate
                  </span>
                )}
                {isCurrent && step.status !== "COMPLETED" && (
                  <span className="rounded bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-teal">
                    Now
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-text-secondary">{statusLabel(step.status)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
