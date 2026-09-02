import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ROLES } from "@/lib/permissions/roles";
import { USER_SELECT, resolveUserOrganizationId } from "@/lib/users/user-write";

const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email"),
  role: z.enum(ROLES),
  branchId: z.string().trim().optional().or(z.literal("")),
  // Stage 9 — required when role is CUSTOMER (scopes the customer portal to
  // one organization), ignored/cleared for every other role.
  organizationId: z.string().trim().optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "users", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: USER_SELECT,
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "users", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: `Email "${data.email}" already in use` }, { status: 409 });
  }

  const org = await resolveUserOrganizationId(data.role, data.organizationId);
  if (!org.ok) return NextResponse.json({ error: org.error }, { status: org.status });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      branchId: data.branchId || null,
      organizationId: org.value,
      passwordHash,
    },
    select: USER_SELECT,
  });

  return NextResponse.json({ user }, { status: 201 });
}
