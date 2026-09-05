"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, StepTracker } from "@/components/ui";
import type { Step } from "@/components/ui";
import { WorkflowRail } from "@/components/workflow/WorkflowRail";
import { StepDetailCard } from "@/components/workflow/StepDetailCard";
import { AuditTrail } from "@/components/workflow/AuditTrail";
import type { StepAction, WorkflowData } from "@/components/workflow/types";

function toTrackerStep(s: WorkflowData["progress"][number]): Step {
  return {
    id: s.id,
    label: s.label,
    status:
      s.status === "COMPLETED"
        ? "completed"
        : s.status === "IN_PROGRESS" || s.status === "PENDING_APPROVAL"
          ? "active"
          : "pending",
  };
}

export function WorkflowPanel({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/workflow`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Failed to load workflow");
      setLoading(false);
      return;
    }
    setData(body as WorkflowData);
    setError(null);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    // Deferred a tick so this isn't a direct setState-during-effect-body call
    // (same React 19 lint rule Stage 2's Combobox/useAutosave hit).
    queueMicrotask(() => void load());
  }, [load]);

  // Derive the effective selection during render (no set-state-in-effect):
  // an explicit pick that still exists wins, else the current actionable step,
  // else the first step.
  const effectiveSelectedId =
    selectedId && data?.progress.some((p) => p.id === selectedId)
      ? selectedId
      : (data?.currentStepId ?? data?.progress[0]?.id ?? null);

  const selectedStep = useMemo(
    () => data?.progress.find((p) => p.id === effectiveSelectedId) ?? null,
    [data, effectiveSelectedId],
  );

  // SKIPPED counts as done for the progress readout — an "if required" step
  // that was skipped shouldn't leave the job stuck below 100%.
  const completedCount = data?.progress.filter((p) => p.status === "COMPLETED" || p.status === "SKIPPED").length ?? 0;

  async function runAction(action: StepAction, payload: { data?: Record<string, unknown>; note?: string }) {
    if (!selectedStep) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/workflow/steps/${selectedStep.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = (await res.json().catch(() => ({}))) as { issues?: { message: string }[]; error?: string; jobCompleted?: boolean; jobReopened?: boolean };
    setBusy(false);
    if (!res.ok) {
      const issues = body.issues?.map((i) => i.message).join("; ");
      setError(issues || body.error || "Action failed");
      return;
    }
    await load();
    // Only a final-step completion or a revert changes Job.status — re-run the
    // server page (which owns the JobForm / two-pane switch) just for those.
    if (body.jobCompleted || body.jobReopened) router.refresh();
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Loading workflow…</p>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <p className="text-sm text-status-danger-fg">{error}</p>
      </Card>
    );
  }

  if (!data?.attached) {
    return (
      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Workflow</h2>
        <p className="mt-2 text-sm text-text-secondary">
          No workflow steps are attached to this job.
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Import tracks exist for Ex-Works and FOB; Export tracks for CIF, DDP and DDU (with Dock/Factory Stuffing
          variants). A job with another Incoterm — or one approved before its track shipped — has no tracker yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              {data.template?.name ?? "Workflow"}
            </h2>
            <p className="text-xs text-text-tertiary">
              {completedCount} of {data.progress.length} steps complete
            </p>
          </div>
        </div>
        <StepTracker orientation="horizontal" steps={data.progress.map(toTrackerStep)} />
      </Card>

      {error && (
        <Card className="border-status-danger-fg/30 bg-status-danger-bg">
          <p className="text-sm text-status-danger-fg">{error}</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <Card>
          <WorkflowRail
            steps={data.progress}
            selectedId={effectiveSelectedId}
            currentStepId={data.currentStepId}
            onSelect={setSelectedId}
          />
        </Card>
        {selectedStep ? (
          <StepDetailCard
            key={selectedStep.id}
            step={selectedStep}
            viewerRole={data.viewerRole}
            busy={busy}
            onAction={runAction}
          />
        ) : (
          <Card>
            <p className="text-sm text-text-secondary">Select a step.</p>
          </Card>
        )}
      </div>

      <AuditTrail entries={data.auditLog} />
    </div>
  );
}
