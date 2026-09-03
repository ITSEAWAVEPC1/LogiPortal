import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { dashboardScope } from "@/lib/permissions/scope";
import { resolvePeriod } from "@/lib/reports/period";
import { buildDashboardReportData } from "@/lib/pdf/dashboard/build-dashboard-report-data";
import { renderDashboardReportWithRetry } from "@/lib/pdf/render-dashboard-report";

// CXO "Download report" — a server-generated PDF (not a screenshot).
// ADMIN and BRANCH_MANAGER only.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "BRANCH_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(
    sp.get("period") ?? "YTD",
    sp.get("from") ?? undefined,
    sp.get("to") ?? undefined,
  );
  const scope = dashboardScope({ role, id: session.user.id, branchId: session.user.branchId });

  const data = await buildDashboardReportData(scope, period);
  const result = await renderDashboardReportWithRetry(data);
  if (!result.ok) {
    return NextResponse.json(
      { error: "PDF generation failed", detail: result.error },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="seawave-dashboard-${period.key.toLowerCase()}.pdf"`,
    },
  });
}
