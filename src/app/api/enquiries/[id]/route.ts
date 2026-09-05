import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { enquiryAutosaveSchema } from "@/lib/validation/enquiry";
import { persistEnquiryDraft } from "@/lib/enquiries/persist-draft";

const DETAIL_INCLUDE = {
  organization: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  doer: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  freightDetail: { include: { packages: { orderBy: { sortOrder: "asc" } } } },
  customsDetail: { include: { commodityLines: { orderBy: { sortOrder: "asc" } } } },
  transportDetail: true,
} as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const enquiry = await prisma.enquiry.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ enquiry });
}

// Lenient autosave/edit — accepts partial/inconsistent draft state. Stage
// 12b removed the approval gate, so this is no longer locked to
// DRAFT/NEEDS_CORRECTION: any Enquiry can be edited right up until it has
// been bundled into a Quotation, at which point it's locked so the quote and
// its source RFQ can't silently drift apart.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.enquiry.findUnique({ where: { id }, include: { quotationEnquiry: { select: { id: true } } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.quotationEnquiry) {
    return NextResponse.json({ error: "This enquiry has been converted to a Quotation and can no longer be edited" }, { status: 409 });
  }

  const body = await request.json();
  const parsed = enquiryAutosaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const enquiry = await prisma.$transaction((tx) => persistEnquiryDraft(tx, id, parsed.data));

  return NextResponse.json({ enquiry });
}
