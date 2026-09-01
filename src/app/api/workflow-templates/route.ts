import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

// List all workflow templates with their steps. Admin-only (the admin
// correction screen). There is no POST — Stage 5 seeds the two Import
// templates and Stage 6 seeds the Export ones; the screen edits, it doesn't
// create from scratch (stage-5.md decision #4).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "workflowTemplates", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.workflowTemplate.findMany({
    orderBy: [{ shipmentType: "asc" }, { incotermKey: "asc" }],
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
      _count: { select: { jobProgress: true } },
    },
  });

  return NextResponse.json({ templates });
}
