// Stage 10d — shared JobAuditLog action labels. Extracted from
// src/components/workflow/AuditTrail.tsx so the per-job panel and the global
// /audit viewer read the same phrasing.

export const JOB_AUDIT_ACTION_LABEL: Record<string, string> = {
  "workflow.attached": "attached the workflow",
  "workflow.step.submitted": "submitted for approval",
  "workflow.step.completed": "completed",
  "workflow.step.approved": "approved",
  "workflow.step.rejected": "rejected",
  "workflow.step.reverted": "reverted",
  "workflow.step.skipped": "skipped",
  "job.completed": "marked the job delivered",
};

/** Distinct action keys, for the viewer's action filter dropdown. */
export const JOB_AUDIT_ACTIONS = Object.keys(JOB_AUDIT_ACTION_LABEL);

export function jobAuditActionLabel(action: string): string {
  return JOB_AUDIT_ACTION_LABEL[action] ?? action;
}

export function jobAuditNote(detail: unknown): string | null {
  if (detail && typeof detail === "object" && "note" in detail) {
    const n = (detail as { note: unknown }).note;
    if (typeof n === "string" && n.trim()) return n;
  }
  return null;
}

export const PORTAL_ACCESS_OUTCOME_LABEL: Record<string, string> = {
  DENIED_CROSS_ORG: "Cross-organization access blocked",
  DENIED_UNLINKED: "Unlinked account access blocked",
  DENIED_NOT_FOUND: "Resource not found",
};
