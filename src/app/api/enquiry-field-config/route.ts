import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { ENQUIRY_FIELD_KEYS } from "@/lib/enquiries/field-config";

const KNOWN_KEYS = new Set(ENQUIRY_FIELD_KEYS.map((k) => `${k.serviceType}:${k.fieldKey}`));

const updateSchema = z.object({
  serviceType: z.enum(["FREIGHT_FORWARDING", "CUSTOMS_CLEARANCE", "TRANSPORTATION", "WAREHOUSING", "EXIM_CONSULTANCY"]),
  fieldKey: z.string().min(1),
  isVisible: z.boolean(),
  isRequired: z.boolean(),
});

// Upsert one (serviceType, fieldKey) override. No DELETE/reset-to-default
// route — toggling back to {isVisible: true, isRequired: true} (today's
// hardcoded default) via this same PATCH has the identical effect, matching
// the app's soft-write-only convention elsewhere.
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "enquiryFieldConfig", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  if (!KNOWN_KEYS.has(`${parsed.data.serviceType}:${parsed.data.fieldKey}`)) {
    return NextResponse.json({ error: "Unknown field key for that service type" }, { status: 400 });
  }

  const { serviceType, fieldKey, isVisible, isRequired } = parsed.data;
  const config = await prisma.enquiryFieldConfig.upsert({
    where: { serviceType_fieldKey: { serviceType, fieldKey } },
    create: { serviceType, fieldKey, isVisible, isRequired },
    update: { isVisible, isRequired },
  });

  return NextResponse.json({ config });
}
