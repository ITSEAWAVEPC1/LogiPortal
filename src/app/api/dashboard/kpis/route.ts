import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { dashboardScope } from "@/lib/permissions/scope";
import { resolvePeriod } from "@/lib/reports/period";
import { getCxoKpis } from "@/lib/dashboard/kpis";

// CXO KPI band data — ADMIN and BRANCH_MANAGER only (plan §4 CXO dashboard).
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

  return NextResponse.json(await getCxoKpis(scope, period));
}
