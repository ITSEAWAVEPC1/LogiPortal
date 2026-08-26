import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  branchId: z.string().min(1, "Branch is required"),
  organizationId: z.string().min(1, "Customer is required"),
});

const STATUS_VALUES = ["DRAFT", "OPEN", "READY_FOR_QUOTATION", "NEEDS_CORRECTION"] as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = STATUS_VALUES.find((s) => s === statusParam);
  const branchId = searchParams.get("branchId") ?? undefined;
  const organizationId = searchParams.get("organizationId") ?? undefined;
  // Added in Stage 3 so the Quotation builder can list an organization's
  // Ready-for-Quotation enquiries that aren't already bundled into another
  // Quotation — additive query param, existing callers unaffected.
  const unattached = searchParams.get("unattached") === "true";
  const q = searchParams.get("q")?.trim();

  const where: Prisma.EnquiryWhereInput = {
    status,
    branchId: branchId || undefined,
    organizationId: organizationId || undefined,
    ...(unattached ? { quotationEnquiry: null } : {}),
    ...(q
      ? {
          OR: [
            { organization: { name: { contains: q, mode: "insensitive" } } },
            { contactPersonName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const enquiries = await prisma.enquiry.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      doer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ enquiries });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId } });
  if (!organization) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // "Doer Name" (source doc's literal field label) is always the session
  // user — never client-supplied — per the locked design decision.
  const enquiry = await prisma.enquiry.create({
    data: {
      branchId: parsed.data.branchId,
      organizationId: parsed.data.organizationId,
      doerId: session.user.id,
      contactPersonName: organization.contactPersonName,
      contactPersonPhone: organization.contactPersonPhone,
      contactPersonEmail: organization.contactPersonEmail,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ enquiry }, { status: 201 });
}
