import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { reportScope } from "@/lib/permissions/scope";
import { canSeeReport, isReportKey } from "@/lib/reports/access";
import { resolvePeriod } from "@/lib/reports/period";
import { runReport } from "@/lib/reports";
import { rowsToCsv } from "@/lib/import/csv-export";
import type { ReportTable } from "@/lib/reports/types";

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? String(v) : v;
}

function tableSection(title: string | null, table: ReportTable): string[][] {
  const out: string[][] = [];
  if (title) out.push([title]);
  out.push(table.columns.map((c) => c.header));
  for (const row of table.rows) out.push(table.columns.map((c) => csvCell(row[c.key])));
  if (table.total) out.push(table.columns.map((c) => csvCell(table.total?.[c.key])));
  return out;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user;
  if (!canAccessScreen(role, "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { report } = await params;
  if (!isReportKey(report) || !canSeeReport(role, report)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(
    sp.get("period") ?? "YTD",
    sp.get("from") ?? undefined,
    sp.get("to") ?? undefined,
  );
  const scope = reportScope({ role, id: session.user.id, branchId: session.user.branchId });

  const result = await runReport(report, scope, {
    period,
    branchId: sp.get("branchId") || undefined,
    organizationId: sp.get("organizationId") || undefined,
    serviceType: sp.get("serviceType") || undefined,
  });

  const sections: string[][] = [...tableSection(null, result.table)];
  for (const et of result.extraTables ?? []) {
    sections.push([]);
    sections.push(...tableSection(et.title, et.table));
  }

  const csv = rowsToCsv(sections[0] ?? [], sections.slice(1));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${report}-${period.key.toLowerCase()}.csv"`,
    },
  });
}
