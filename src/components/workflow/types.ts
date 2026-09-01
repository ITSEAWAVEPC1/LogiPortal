// Client-side shapes for the workflow panel, mirroring the JSON returned by
// GET /api/jobs/[id]/workflow.

export type WorkflowStepStatus = "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETED" | "SKIPPED";

export interface StepFieldDef {
  key: string;
  label: string;
  type: "date" | "text" | "number";
  required?: boolean;
  prefillFrom?: string;
}

export interface Person {
  id: string;
  name: string;
}

export interface WorkflowProgressStep {
  id: string;
  stepKey: string;
  label: string;
  sortOrder: number;
  status: WorkflowStepStatus;
  data: Record<string, unknown> | null;
  fields: StepFieldDef[];
  ownerRole: string;
  approverRole: string | null;
  isApprovalGate: boolean;
  completedBy: Person | null;
  completedAt: string | null;
  approvedBy: Person | null;
  approvedAt: string | null;
  reviewNote: string | null;
}

export interface WorkflowAuditEntry {
  id: string;
  action: string;
  stepKey: string | null;
  detail: unknown;
  createdAt: string;
  actor: Person | null;
}

export interface WorkflowData {
  attached: boolean;
  job: { id: string; status: string; shipmentType: string; incoterm: string | null };
  template: { id: string; name: string; incotermKey: string } | null;
  progress: WorkflowProgressStep[];
  auditLog: WorkflowAuditEntry[];
  currentStepId: string | null;
  viewerRole: string;
  canManageTemplates: boolean;
}

export type StepAction = "save" | "complete" | "submit" | "approve" | "reject" | "revert";
