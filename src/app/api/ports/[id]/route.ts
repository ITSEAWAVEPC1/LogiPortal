import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const portUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

// No DELETE handler — deactivation goes through PATCH { isActive: false },
// matching the rest of the app's soft-delete-only convention.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = portUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const action = typeof parsed.data.isActive === "boolean" ? "delete" : "edit";
  if (!can(session.user.role, "ports", action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.code) {
    const existing = await prisma.port.findUnique({ where: { code: parsed.data.code } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: `Port code "${parsed.data.code}" already in use` }, { status: 409 });
    }
  }

  const port = await prisma.port.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ port });
}
