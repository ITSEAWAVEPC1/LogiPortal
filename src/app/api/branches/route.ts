import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const branchInputSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Branch code is required")
    .transform((v) => v.toUpperCase()),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "branches", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branches = await prisma.branch.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, organizations: true } } },
  });
  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "branches", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = branchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.branch.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: `Branch code "${parsed.data.code}" already in use` }, { status: 409 });
  }

  const branch = await prisma.branch.create({ data: parsed.data });
  return NextResponse.json({ branch }, { status: 201 });
}
