import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

// Minimal staff lookup (id/name/role only) for the Organization Branch form's
// Sales Person / Collection Executive / Account Manager dropdowns. Kept
// separate from GET /api/users, which is Admin-only ("users":"view") — those
// pickers need to work for any role that can create/edit Organizations
// (Doer, Sales, Branch Manager, Accounts), not just Admin.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !can(session.user.role, "users", "view") &&
    !can(session.user.role, "customers", "create") &&
    !can(session.user.role, "customers", "edit")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  return NextResponse.json({ users });
}
