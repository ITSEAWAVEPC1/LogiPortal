import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { enquirySubmitSchema } from "@/lib/validation/enquiry";
import { persistEnquiryDraft } from "@/lib/enquiries/persist-draft";
import { checkConfigurableFieldRequirements, getEnquiryFieldConfigMap } from "@/lib/enquiries/field-config";

// Strict submit transition, DRAFT|NEEDS_CORRECTION -> READY_FOR_QUOTATION
// directly. Stage 12b removed the Branch Manager review gate (previously
// this went to OPEN and waited for a separate /review call) — submitting now
// takes an Enquiry straight to ready-for-quotation.
//
// Accepts the current form body and persists it in the same transaction as
// the status transition, replacing the old two-round-trip client pattern
// (a full autosave PATCH immediately followed by a separate submit PATCH,
// which also re-fetched from the DB to validate data it had just been sent).
// Since enquirySubmitSchema is a strict superset of the lenient autosave
// schema, one parse covers both persistence and validation.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.enquiry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status !== "DRAFT" && existing.status !== "NEEDS_CORRECTION") {
    return NextResponse.json({ error: `Cannot submit an enquiry with status ${existing.status}` }, { status: 409 });
  }

  const body = await request.json();
  const parsed = enquirySubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const configMap = await getEnquiryFieldConfigMap();
  const fieldIssues = checkConfigurableFieldRequirements(parsed.data, configMap);
  if (fieldIssues.length > 0) {
    return NextResponse.json({ error: "Validation failed", issues: fieldIssues }, { status: 400 });
  }

  const enquiry = await prisma.$transaction(async (tx) => {
    await persistEnquiryDraft(tx, id, parsed.data);
    return tx.enquiry.update({ where: { id }, data: { status: "READY_FOR_QUOTATION" } });
  });

  return NextResponse.json({ enquiry });
}
