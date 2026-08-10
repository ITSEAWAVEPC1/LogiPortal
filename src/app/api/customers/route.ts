import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { organizationInputSchema } from "@/lib/validation/organization";
import { findDuplicateGst, normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "customers", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const branchId = searchParams.get("branchId") ?? undefined;
  const status = searchParams.get("status"); // "active" | "inactive" | null (= all)

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: status === "inactive" ? false : status === "active" ? true : undefined,
      branchId: branchId || undefined,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactPersonName: { contains: q, mode: "insensitive" } },
              { kycDetail: { gstNumber: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { kycDetail: true, branch: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "customers", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = organizationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  if (data.gstNumber) {
    const duplicate = await findDuplicateGst(data.gstNumber);
    if (duplicate) {
      return NextResponse.json(
        { error: `GST number already used by "${duplicate.name}"`, existingOrganizationId: duplicate.id },
        { status: 409 },
      );
    }
  }

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      contactPersonName: data.contactPersonName || null,
      contactPersonPhone: data.contactPersonPhone || null,
      contactPersonEmail: data.contactPersonEmail || null,
      city: data.city || null,
      state: data.state || null,
      branchId: data.branchId || null,
      createdById: session.user.id,
      kycDetail: {
        create: {
          gstNumber: data.gstNumber ? normalizeGst(data.gstNumber) : null,
          panNumber: data.panNumber ? normalizePan(data.panNumber) : null,
          tanNumber: data.tanNumber ? normalizeTan(data.tanNumber) : null,
        },
      },
    },
    include: { kycDetail: true, branch: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ organization }, { status: 201 });
}
