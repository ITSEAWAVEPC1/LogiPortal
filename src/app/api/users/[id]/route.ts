import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ROLES } from "@/lib/permissions/roles";
import { resolveUserOrganizationId } from "@/lib/users/user-write";

const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  branchId: z.string().trim().optional().or(z.literal("")),
  // Stage 9 — customer↔organization link. Enforced against the effective role
  // (see below): required when the user is/becomes CUSTOMER, cleared otherwise.
  organizationId: z.string().trim().optional().or(z.literal("")),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

// No DELETE handler — deactivation goes through PATCH { isActive: false }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const action = typeof data.isActive === "boolean" ? "delete" : "edit";
  if (!can(session.user.role, "users", action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { role: true, organizationId: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only recompute the organization link when role or organizationId is part of
  // this request — a plain deactivate must not re-validate (and possibly reject
  // on) an org that has since been deactivated.
  let organizationIdUpdate: string | null | undefined;
  if (data.role !== undefined || data.organizationId !== undefined) {
    const effectiveRole = data.role ?? existing.role;
    const wanted = data.organizationId !== undefined ? data.organizationId : (existing.organizationId ?? "");
    const org = await resolveUserOrganizationId(effectiveRole, wanted);
    if (!org.ok) return NextResponse.json({ error: org.error }, { status: org.status });
    organizationIdUpdate = org.value;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      role: data.role,
      branchId: data.branchId === "" ? null : data.branchId,
      organizationId: organizationIdUpdate,
      isActive: data.isActive,
      passwordHash: data.password ? await bcrypt.hash(data.password, 10) : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branch: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ user });
}
