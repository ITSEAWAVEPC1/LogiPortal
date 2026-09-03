import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

const PAGE = 20;

// Every notification query is scoped to the caller's own rows. `countOnly=1`
// returns just the unread badge count; `filter=unread` limits the list;
// `cursor` is the id of the last row from the previous page.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const sp = request.nextUrl.searchParams;

  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  if (sp.get("countOnly")) return NextResponse.json({ unreadCount });

  const where = { userId, ...(sp.get("filter") === "unread" ? { readAt: null } : {}) };
  const cursor = sp.get("cursor");
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkPath: true,
      readAt: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > PAGE;
  const items = hasMore ? rows.slice(0, PAGE) : rows;
  return NextResponse.json({
    items,
    unreadCount,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
