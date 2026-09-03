import { JOB_AUDIT_ACTIONS, jobAuditActionLabel } from "@/lib/audit/labels";

const inputCls =
  "rounded-md border border-border-subtle bg-background px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-teal";

interface AuditFiltersProps {
  tab: string;
  values: { actorId: string; action: string; from: string; to: string; branchId: string };
  /** actor options — job tab only */
  actors?: Array<{ id: string; name: string; role: string }>;
  /** branch options — ADMIN on the job tab only; omit to hide */
  branches?: Array<{ id: string; name: string }>;
  csvHref: string;
}

export function AuditFilters({ tab, values, actors, branches, csvHref }: AuditFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        {tab === "job" && actors ? (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Actor
            <select name="actorId" defaultValue={values.actorId} className={inputCls}>
              <option value="">Anyone</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {tab === "job" ? (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Action
            <select name="action" defaultValue={values.action} className={inputCls}>
              <option value="">Any action</option>
              {JOB_AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {jobAuditActionLabel(a)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {tab === "job" && branches ? (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Branch
            <select name="branchId" defaultValue={values.branchId} className={inputCls}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          From
          <input type="date" name="from" defaultValue={values.from} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          To
          <input type="date" name="to" defaultValue={values.to} className={inputCls} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-teal/90"
        >
          Apply
        </button>
      </form>
      <a
        href={csvHref}
        className="ml-auto rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-secondary hover:bg-background"
      >
        Download CSV
      </a>
    </div>
  );
}
