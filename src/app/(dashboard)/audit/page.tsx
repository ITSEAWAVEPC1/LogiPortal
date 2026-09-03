import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { reportScope } from "@/lib/permissions/scope";
import { listReportBranches } from "@/lib/reports/common";
import {
  getAuditActors,
  getJobAuditPage,
  getLoginAuditPage,
  getPortalAccessPage,
} from "@/lib/audit/queries";
import { Card, CardContent } from "@/components/shadcn/card";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditTable, type AuditColumn } from "@/components/audit/AuditTable";
import { cn } from "@/lib/utils/cn";

interface AuditPageProps {
  searchParams: Promise<{
    tab?: string;
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
    branchId?: string;
    cursor?: string;
  }>;
}

function parseDay(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (endOfDay) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { role } = session.user;
  if (!canAccessScreen(role, "audit")) redirect("/");

  const sp = await searchParams;
  const isAdmin = role === "ADMIN";
  let tab = sp.tab === "portal" || sp.tab === "login" ? sp.tab : "job";
  if ((tab === "portal" || tab === "login") && !isAdmin) tab = "job";

  const from = parseDay(sp.from);
  const to = parseDay(sp.to, true);
  const scope = reportScope({ role, id: session.user.id, branchId: session.user.branchId });

  const carry: Record<string, string | undefined> = {
    tab,
    actorId: sp.actorId,
    action: sp.action,
    from: sp.from,
    to: sp.to,
    branchId: sp.branchId,
  };
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...carry, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  let columns: AuditColumn[] = [];
  let rows: Array<Record<string, string>> = [];
  let nextCursor: string | null = null;

  if (tab === "job") {
    const page = await getJobAuditPage(scope, {
      actorId: sp.actorId || undefined,
      action: sp.action || undefined,
      from,
      to,
      branchId: sp.branchId || undefined,
      cursor: sp.cursor || undefined,
    });
    nextCursor = page.nextCursor;
    columns = [
      { key: "when", header: "When" },
      { key: "actor", header: "Actor" },
      { key: "action", header: "Action" },
      { key: "job", header: "Job" },
      { key: "branch", header: "Branch" },
      { key: "step", header: "Step" },
      { key: "note", header: "Note", wide: true },
    ];
    rows = page.rows.map((r) => ({
      when: fmt(r.createdAt),
      actor: `${r.actorName} (${r.actorRole})`,
      action: r.actionLabel,
      job: r.jobRef,
      branch: r.branchName,
      step: r.stepKey ? r.stepKey.replace(/_/g, " ") : "—",
      note: r.note ?? "",
    }));
  } else if (tab === "portal") {
    const page = await getPortalAccessPage({ from, to, cursor: sp.cursor || undefined });
    nextCursor = page.nextCursor;
    columns = [
      { key: "when", header: "When" },
      { key: "user", header: "User" },
      { key: "outcome", header: "Outcome" },
      { key: "path", header: "Path", mono: true, wide: true },
      { key: "resource", header: "Resource", mono: true },
    ];
    rows = page.rows.map((r) => ({
      when: fmt(r.createdAt),
      user: r.userEmail,
      outcome: r.outcomeLabel,
      path: r.path,
      resource: r.resource,
    }));
  } else {
    const page = await getLoginAuditPage({ from, to, cursor: sp.cursor || undefined });
    nextCursor = page.nextCursor;
    columns = [
      { key: "when", header: "When" },
      { key: "user", header: "User" },
      { key: "role", header: "Role" },
      { key: "ip", header: "IP" },
      { key: "ua", header: "User agent", wide: true },
    ];
    rows = page.rows.map((r) => ({
      when: fmt(r.createdAt),
      user: `${r.userName} · ${r.userEmail}`,
      role: r.role,
      ip: r.ipAddress,
      ua: r.userAgent,
    }));
  }

  const [actors, branches] = await Promise.all([
    tab === "job" ? getAuditActors() : Promise.resolve([]),
    tab === "job" && scope.kind === "ALL" ? listReportBranches(null) : Promise.resolve([]),
  ]);

  const tabs: Array<{ key: string; label: string }> = [
    { key: "job", label: "Job activity" },
    ...(isAdmin
      ? [
          { key: "portal", label: "Portal access" },
          { key: "login", label: "Logins" },
        ]
      : []),
  ];

  const csvParams = new URLSearchParams({ tab });
  for (const [k, v] of Object.entries(carry)) if (v && k !== "tab") csvParams.set(k, v);
  const csvHref = `/api/audit/export?${csvParams}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Audit Trail</h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? "All job activity, portal access attempts, and logins." : "Job activity for your branch."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border-subtle">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === t.key
                ? "border-brand-teal font-medium text-brand-teal"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <AuditFilters
            tab={tab}
            values={{
              actorId: sp.actorId ?? "",
              action: sp.action ?? "",
              from: sp.from ?? "",
              to: sp.to ?? "",
              branchId: sp.branchId ?? "",
            }}
            actors={tab === "job" ? actors : undefined}
            branches={branches.length ? branches : undefined}
            csvHref={csvHref}
          />
          <AuditTable columns={columns} rows={rows} />
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>{rows.length} shown</span>
            <div className="flex gap-2">
              {sp.cursor ? (
                <Link
                  href={qs({ cursor: undefined })}
                  className="rounded-md border border-border-subtle px-3 py-1 hover:bg-background"
                >
                  Start over
                </Link>
              ) : null}
              {nextCursor ? (
                <Link
                  href={qs({ cursor: nextCursor })}
                  className="rounded-md border border-border-subtle px-3 py-1 hover:bg-background"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
