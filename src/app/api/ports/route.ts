import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const portInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().optional().or(z.literal("")),
});

// GET is available to any role that can view Enquiries (the Freight
// Forwarding form's Port of Loading/Discharge dropdown needs this list) —
// not gated behind the Admin-only "ports" CRUD capability, which only covers
// create/edit/delete below. Same split as bill-types' GET route.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "view") && !can(session.user.role, "ports", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ports = await prisma.port.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ ports });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "ports", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = portInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const code = parsed.data.code || null;
  if (code) {
    const existing = await prisma.port.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Port code "${code}" already in use` }, { status: 409 });
    }
  }

  const port = await prisma.port.create({ data: { name: parsed.data.name, code } });
  return NextResponse.json({ port }, { status: 201 });
}
