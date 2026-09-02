import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { documentTypeUpdateSchema } from "@/lib/validation/document";

// No DELETE handler — deactivation goes through PATCH { isActive: false },
// matching the app-wide soft-delete-only convention.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = documentTypeUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const action = typeof parsed.data.isActive === "boolean" ? "delete" : "edit";
  if (!can(session.user.role, "documentTypes", action)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.documentType.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const documentType = await prisma.documentType.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ documentType });
}
