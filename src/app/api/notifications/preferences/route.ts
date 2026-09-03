import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

// Self-service, own row only (mirrors /api/preferences/[screenKey]).
const DEFAULTS = { inAppEnabled: true, emailEnabled: true, mutedTypes: [] as string[] };

const putSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  mutedTypes: z.array(z.enum(NOTIFICATION_TYPES)).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({
    preference: pref
      ? {
          inAppEnabled: pref.inAppEnabled,
          emailEnabled: pref.emailEnabled,
          mutedTypes: Array.isArray(pref.mutedTypes) ? pref.mutedTypes : [],
        }
      : DEFAULTS,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const d = parsed.data;

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      inAppEnabled: d.inAppEnabled ?? true,
      emailEnabled: d.emailEnabled ?? true,
      mutedTypes: d.mutedTypes ?? [],
    },
    update: {
      ...(d.inAppEnabled !== undefined ? { inAppEnabled: d.inAppEnabled } : {}),
      ...(d.emailEnabled !== undefined ? { emailEnabled: d.emailEnabled } : {}),
      ...(d.mutedTypes !== undefined ? { mutedTypes: d.mutedTypes } : {}),
    },
  });

  return NextResponse.json({
    preference: {
      inAppEnabled: pref.inAppEnabled,
      emailEnabled: pref.emailEnabled,
      mutedTypes: Array.isArray(pref.mutedTypes) ? pref.mutedTypes : [],
    },
  });
}
