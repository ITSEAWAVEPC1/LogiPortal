import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";

const reviewSchema = z.object({
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().optional(),
});

// Branch Manager's approval gate: OPEN -> READY_FOR_QUOTATION or NEEDS_CORRECTION.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiries", "approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.decision === "needs_correction" && !parsed.data.note) {
    return NextResponse.json(
      { error: "A note is required when flagging an enquiry back for correction" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const enquiry = await prisma.enquiry.findUnique({ where: { id } });
  if (!enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (enquiry.status !== "OPEN") {
    return NextResponse.json({ error: `Cannot review an enquiry with status ${enquiry.status}` }, { status: 409 });
  }

  const updated = await prisma.enquiry.update({
    where: { id },
    data: {
      status: parsed.data.decision === "approve" ? "READY_FOR_QUOTATION" : "NEEDS_CORRECTION",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ enquiry: updated });
}
