import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

// Mark one of the caller's own notifications read / unread.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { read?: boolean };

  const notif = await prisma.notification.findUnique({ where: { id }, select: { userId: true } });
  if (!notif || notif.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: body.read === false ? null : new Date() },
    select: { id: true, readAt: true },
  });
  return NextResponse.json({ notification: updated });
}
