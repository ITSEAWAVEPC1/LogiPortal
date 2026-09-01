"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Input, Select } from "@/components/ui";
import { ROLE_LABELS, ROLES } from "@/lib/permissions/roles";

interface StepRow {
  id?: string;
  stepKey: string;
  label: string;
  sortOrder: number;
  ownerRole: string;
  approverRole: string | null;
  isApprovalGate: boolean;
  isActive: boolean;
}

export interface TemplateRow {
  id: string;
  name: string;
  shipmentType: string;
  incotermKey: string;
  isActive: boolean;
  jobCount: number;
  steps: StepRow[];
}

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function TemplateEditor({ template }: { template: TemplateRow }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [isActive, setIsActive] = useState(template.isActive);
  const [steps, setSteps] = useState<StepRow[]>(template.steps);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function mutate(i: number, patch: Partial<StepRow>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        stepKey: "",
        label: "",
        sortOrder: prev.length,
        ownerRole: "DOER",
        approverRole: null,
        isApprovalGate: false,
        isActive: true,
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const payload = {
      name,
      isActive,
      steps: steps.map((s, idx) => ({
        ...(s.id ? { id: s.id } : { stepKey: s.stepKey || slugify(s.label) }),
        label: s.label,
        sortOrder: idx,
        ownerRole: s.ownerRole,
        approverRole: s.isApprovalGate ? (s.approverRole ?? "BRANCH_MANAGER") : null,
        isApprovalGate: s.isApprovalGate,
        isActive: s.isActive,
      })),
    };
    const res = await fetch(`/api/workflow-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      const issues = (body.issues as { message: string }[] | undefined)?.map((i) => i.message).join("; ");
      setMessage({ kind: "err", text: issues || body.error || "Save failed" });
      return;
    }
    setMessage({ kind: "ok", text: "Saved. New jobs use the updated template; jobs already in progress are unchanged." });
    router.refresh();
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
          <Badge variant="neutral">
            {template.shipmentType} / {template.incotermKey}
          </Badge>
          <span className="text-xs text-text-tertiary">{template.jobCount} job step-rows reference this</span>
        </div>
        <Checkbox label="Template active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Step</th>
              <th className="py-1 pr-2">Owner</th>
              <th className="py-1 pr-2">Approval gate</th>
              <th className="py-1 pr-2">Active</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={s.id ?? `new-${i}`} className="border-t border-border-subtle align-top">
                <td className="py-2 pr-2 text-text-tertiary">{i + 1}</td>
                <td className="py-2 pr-2">
                  <Input
                    value={s.label}
                    placeholder="Step label"
                    onChange={(e) => mutate(i, { label: e.target.value })}
                  />
                  <span className="mt-0.5 block text-[11px] text-text-tertiary">
                    {s.id ? s.stepKey : s.stepKey || slugify(s.label) || "auto-key"}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <Select
                    options={ROLE_OPTIONS}
                    value={s.ownerRole}
                    onChange={(e) => mutate(i, { ownerRole: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Checkbox
                    label="Requires approval"
                    checked={s.isApprovalGate}
                    onChange={(e) =>
                      mutate(i, {
                        isApprovalGate: e.target.checked,
                        approverRole: e.target.checked ? (s.approverRole ?? "BRANCH_MANAGER") : null,
                      })
                    }
                  />
                  {s.isApprovalGate && (
                    <Select
                      className="mt-1"
                      options={ROLE_OPTIONS}
                      value={s.approverRole ?? "BRANCH_MANAGER"}
                      onChange={(e) => mutate(i, { approverRole: e.target.value })}
                    />
                  )}
                </td>
                <td className="py-2 pr-2">
                  <Checkbox
                    label=""
                    checked={s.isActive}
                    onChange={(e) => mutate(i, { isActive: e.target.checked })}
                  />
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                    ↓
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={addStep}>
          + Add step
        </Button>
        <div className="flex items-center gap-3">
          {message && (
            <span className={message.kind === "ok" ? "text-xs text-text-secondary" : "text-xs text-status-danger-fg"}>
              {message.text}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function WorkflowTemplateManager({ templates }: { templates: TemplateRow[] }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Workflow Templates</h1>
      <p className="mb-4 text-sm text-text-secondary">
        Correct a step sequence without a deploy. Edits apply to jobs approved <em>after</em> the change — jobs
        already in a workflow keep the steps they started with. Steps are never deleted; deactivate one instead.
      </p>
      <div className="flex flex-col gap-4">
        {templates.map((t) => (
          <TemplateEditor key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
