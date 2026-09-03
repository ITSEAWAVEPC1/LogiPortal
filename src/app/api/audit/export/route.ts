import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { canAccessScreen } from "@/lib/permissions/access-matrix";
import { reportScope } from "@/lib/permissions/scope";
import { rowsToCsv } from "@/lib/import/csv-export";
import {
  getJobAuditPage,
  getLoginAuditPage,
  getPortalAccessPage,
} from "@/lib/audit/queries";
import { jobAuditToCsv, loginAuditToCsv, portalAccessToCsv } from "@/lib/audit/csv";

const MAX_PAGES = 25; // 25 * 200 = 5000 rows

function parseDay(s: string | null, endOfDay = false): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (endOfDay) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user;
  if (!canAccessScreen(role, "audit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const tab = sp.get("tab") === "portal" || sp.get("tab") === "login" ? sp.get("tab")! : "job";
  const isAdmin = role === "ADMIN";
  if ((tab === "portal" || tab === "login") && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = parseDay(sp.get("from"));
  const to = parseDay(sp.get("to"), true);

  let headers: string[] = [];
  const body: string[][] = [];

  if (tab === "job") {
    const scope = reportScope({ role, id: session.user.id, branchId: session.user.branchId });
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await getJobAuditPage(scope, {
        actorId: sp.get("actorId") || undefined,
        action: sp.get("action") || undefined,
        from,
        to,
        branchId: sp.get("branchId") || undefined,
        cursor,
        limit: 200,
      });
      const csv = jobAuditToCsv(page.rows);
      headers = csv.headers;
      body.push(...csv.body);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } else if (tab === "portal") {
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await getPortalAccessPage({ from, to, cursor, limit: 200 });
      const csv = portalAccessToCsv(page.rows);
      headers = csv.headers;
      body.push(...csv.body);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } else {
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await getLoginAuditPage({ from, to, cursor, limit: 200 });
      const csv = loginAuditToCsv(page.rows);
      headers = csv.headers;
      body.push(...csv.body);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }

  return new NextResponse(rowsToCsv(headers, body), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-${tab}.csv"`,
    },
  });
}
