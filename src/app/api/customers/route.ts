import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { organizationDetailInputSchema } from "@/lib/validation/organization-detail";
import { findDuplicateGst, normalizeGst, normalizePan, normalizeTan } from "@/lib/validation/kyc";
import { getOrganizationSectionPermissions } from "@/lib/permissions/organization-sections";
import { organizationDetailInclude } from "@/lib/organizations/organization-include";
import { writeOrganizationChildren } from "@/lib/organizations/write-organization-children";

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
  // Optional role filter (e.g. ?role=shipper) so pickers elsewhere in the app
  // can select organizations by the role they play — see acceptance
  // criteria #6 in docs/stage-checklists/customer-master-v2.md for how this
  // was spot-checked (no existing screen has a per-role picker yet).
  const role = searchParams.get("role");
  const roleField = (
    { shipper: "isShipper", consignee: "isConsignee", agent: "isAgent", carrier: "isCarrier", service: "isService" } as const
  )[role ?? ""];

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: status === "inactive" ? false : status === "active" ? true : undefined,
      branchId: branchId || undefined,
      ...(roleField ? { [roleField]: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { alias: { contains: q, mode: "insensitive" } },
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
  const parsed = organizationDetailInputSchema.safeParse(body);
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

  const sectionPermissions = await getOrganizationSectionPermissions(session.user.role);

  // A branch-heavy submission can mean a dozen+ sequential statements against
  // Neon's real network latency (ap-southeast-1) — the interactive
  // transaction default (5s) isn't enough headroom, same issue Stage 1 hit
  // with bulk import (see docs/stage-checklists/stage-1.md decision #2).
  // Bumped rather than batched, since these are heterogeneous nested writes,
  // not repeated identical rows.
  const createdId = await prisma.$transaction(
    async (tx) => {
      const created = await tx.organization.create({
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
          defaultCurrency: sectionPermissions.canEditBilling ? data.defaultCurrency || null : null,
          createdById: session.user.id,
          kycDetail: {
            create: {
              gstNumber: data.gstNumber ? normalizeGst(data.gstNumber) : null,
              panNumber: data.panNumber ? normalizePan(data.panNumber) : null,
              tanNumber: data.tanNumber ? normalizeTan(data.tanNumber) : null,
            },
          },
        },
      });

      await writeOrganizationChildren(tx, created.id, data, sectionPermissions);

      return created.id;
    },
    { timeout: 20000, maxWait: 10000 },
  );

  // Fetched after commit, not inside the transaction — this full nested
  // include is a read-back for the response, not part of the atomic write.
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: createdId },
    include: organizationDetailInclude,
  });

  return NextResponse.json({ organization }, { status: 201 });
}
