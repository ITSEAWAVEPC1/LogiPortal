import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

function toCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const billTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    // Blank code auto-derives from name (matches the settings screen's
    // "leave blank to auto-generate" placeholder).
    code: z.string().trim().optional().or(z.literal("")),
  })
  .transform((v) => ({ name: v.name, code: toCode(v.code || v.name) }))
  .refine((v) => v.code.length > 0, { message: "Could not derive a code from the name", path: ["code"] });

// GET is available to any role that can at least view/edit the Organization
// Billing tab (Admin's CRUD screen and the Billing tab's Bill Type dropdown
// both need this list) — not gated behind the Admin-only "billTypes" CRUD
// capability, which only covers create/edit/delete below.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "customers", "view") && !can(session.user.role, "billTypes", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const billTypes = await prisma.billType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ billTypes });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "billTypes", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = billTypeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.billType.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return NextResponse.json({ error: `Bill type code "${parsed.data.code}" already in use` }, { status: 409 });
  }

  const billType = await prisma.billType.create({ data: parsed.data });
  return NextResponse.json({ billType }, { status: 201 });
}
