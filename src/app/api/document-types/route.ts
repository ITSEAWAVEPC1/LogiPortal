import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { documentTypeCreateSchema } from "@/lib/validation/document";

// GET is open to any role that can view documents — the DocumentsPanel needs
// the list to populate its Generate/Upload type pickers. Create is Admin-only.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "documents", "view") && !can(session.user.role, "documentTypes", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documentTypes = await prisma.documentType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json({ documentTypes });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "documentTypes", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = documentTypeCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.documentType.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: `Document type code "${parsed.data.code}" already in use` }, { status: 409 });
  }

  const documentType = await prisma.documentType.create({
    data: { ...parsed.data, sortOrder: 50 },
  });
  return NextResponse.json({ documentType }, { status: 201 });
}
