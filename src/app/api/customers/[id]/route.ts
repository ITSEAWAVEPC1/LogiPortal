import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { organizationDetailInputSchema } from "@/lib/validation/organization-detail";
import { findDuplicateGst, normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";
import { getOrganizationSectionPermissions } from "@/lib/permissions/organization-sections";
import { organizationDetailInclude } from "@/lib/organizations/organization-include";
import { writeOrganizationChildren } from "@/lib/organizations/write-organization-children";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "customers", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: organizationDetailInclude,
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

  const sectionPermissions = await getOrganizationSectionPermissions(session.user.role);
  const canEditGeneral = can(session.user.role, "customers", "edit");
  const canEditAnySection =
    sectionPermissions.canEditBranches || sectionPermissions.canEditBilling || sectionPermissions.canEditAccountInfo;

  // Whole-resource "customers":"edit" (Stage 1's coarse capability) covers
  // the General tab's identity fields. Accounts doesn't have that capability
  // but must still be able to save Account Info/Billing here — Section 4.3's
  // field groups are the finer-grained gate for those sections specifically.
  // A request needs at least one of the two to reach the write path at all.
  if (!canEditGeneral && !canEditAnySection) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = organizationDetailInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  if (canEditGeneral && data.gstNumber) {
    const duplicate = await findDuplicateGst(data.gstNumber, id);
    if (duplicate) {
      return NextResponse.json(
        { error: `GST number already used by "${duplicate.name}"`, existingOrganizationId: duplicate.id },
        { status: 409 },
      );
    }
  }

  // See POST /api/customers for why the timeout is bumped — same nested,
  // heterogeneous, multi-round-trip write against Neon's real network latency.
  await prisma.$transaction(
    async (tx) => {
      // General identity fields (name, alias, contact, role flags, KYC) are
      // only touched when the role has whole-resource edit rights — an
      // Accounts-only save (Account Info/Billing sections) must not be able
      // to rename the organization or flip its role flags via this request.
      if (canEditGeneral) {
        await tx.organization.update({
          where: { id },
          data: {
            name: data.name,
            alias: data.alias || null,
            contactPersonName: data.contactPersonName || null,
            contactPersonPhone: data.contactPersonPhone || null,
            contactPersonEmail: data.contactPersonEmail || null,
            city: data.city || null,
            state: data.state || null,
            branchId: data.branchId || null,
            isShipper: data.isShipper,
            isConsignee: data.isConsignee,
            isAgent: data.isAgent,
            isCarrier: data.isCarrier,
            isService: data.isService,
            isGlobal: data.isGlobal,
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
        });
      }
      // Billing-gated field: only touch defaultCurrency if this role may edit Billing.
      if (sectionPermissions.canEditBilling) {
        await tx.organization.update({ where: { id }, data: { defaultCurrency: data.defaultCurrency || null } });
      }

      await writeOrganizationChildren(tx, id, data, sectionPermissions);
    },
    { timeout: 20000, maxWait: 10000 },
  );

  // Fetched after commit, not inside the transaction — this full nested
  // include is a read-back for the response, not part of the atomic write.
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id },
    include: organizationDetailInclude,
  });

  return NextResponse.json({ organization });
}
