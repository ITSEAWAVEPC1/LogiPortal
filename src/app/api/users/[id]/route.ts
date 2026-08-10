import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ROLES } from "@/lib/permissions/roles";

const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
  branchId: z.string().trim().optional().or(z.literal("")),
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

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      role: data.role,
      branchId: data.branchId === "" ? null : data.branchId,
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
    },
  });

  return NextResponse.json({ user });
}
