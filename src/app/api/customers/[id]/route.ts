import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { organizationInputSchema } from "@/lib/validation/organization";
import { findDuplicateGst, normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "customers", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { kycDetail: true, branch: { select: { id: true, name: true } } },
  });
  if (!organization) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ organization });
}

// No DELETE handler — deactivation goes through PATCH { isActive: false } so
// "soft delete only" is structurally true, not just a policy note.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.isActive === "boolean") {
    if (!can(session.user.role, "customers", "delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const organization = await prisma.organization.update({
      where: { id },
      data: { isActive: body.isActive },
      include: { kycDetail: true, branch: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ organization });
  }

  if (!can(session.user.role, "customers", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = organizationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  if (data.gstNumber) {
    const duplicate = await findDuplicateGst(data.gstNumber, id);
    if (duplicate) {
      return NextResponse.json(
        { error: `GST number already used by "${duplicate.name}"`, existingOrganizationId: duplicate.id },
        { status: 409 },
      );
    }
  }

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      name: data.name,
      contactPersonName: data.contactPersonName || null,
      contactPersonPhone: data.contactPersonPhone || null,
      contactPersonEmail: data.contactPersonEmail || null,
      city: data.city || null,
      state: data.state || null,
      branchId: data.branchId || null,
      kycDetail: {
        upsert: {
          create: {
            gstNumber: data.gstNumber ? normalizeGst(data.gstNumber) : null,
            panNumber: data.panNumber ? normalizePan(data.panNumber) : null,
            tanNumber: data.tanNumber ? normalizeTan(data.tanNumber) : null,
          },
          update: {
            gstNumber: data.gstNumber ? normalizeGst(data.gstNumber) : null,
            panNumber: data.panNumber ? normalizePan(data.panNumber) : null,
            tanNumber: data.tanNumber ? normalizeTan(data.tanNumber) : null,
          },
        },
      },
    },
    include: { kycDetail: true, branch: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ organization });
}
