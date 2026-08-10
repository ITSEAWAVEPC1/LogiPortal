import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const branchUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .transform((v) => v.toUpperCase())
    .optional(),
  isActive: z.boolean().optional(),
});

// No DELETE handler — deactivation goes through PATCH { isActive: false }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = branchUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const action = typeof parsed.data.isActive === "boolean" ? "delete" : "edit";
  if (!can(session.user.role, "branches", action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.code) {
    const existing = await prisma.branch.findUnique({ where: { code: parsed.data.code } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: `Branch code "${parsed.data.code}" already in use` }, { status: 409 });
    }
  }

  const branch = await prisma.branch.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ branch });
}
