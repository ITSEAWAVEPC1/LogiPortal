import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

const columnsSchema = z.object({ columns: z.array(z.string()) });

// Per-user, per-screen list-column preference (currently just the Customers
// list's "Customize Columns" picker). Deliberately unauthenticated beyond
// "is logged in" — this is just a UI layout preference for the requester's
// own account, not data access.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ screenKey: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenKey } = await params;
  const preference = await prisma.userColumnPreference.findUnique({
    where: { userId_screenKey: { userId: session.user.id, screenKey } },
  });

  return NextResponse.json({ columns: (preference?.columns as string[] | undefined) ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ screenKey: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenKey } = await params;
  const body = await request.json();
  const parsed = columnsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const preference = await prisma.userColumnPreference.upsert({
    where: { userId_screenKey: { userId: session.user.id, screenKey } },
    create: { userId: session.user.id, screenKey, columns: parsed.data.columns },
    update: { columns: parsed.data.columns },
  });

  return NextResponse.json({ columns: preference.columns });
}
