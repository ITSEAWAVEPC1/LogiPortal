import { NextRequest, NextResponse } from "next/server";
import { drainEmailQueue, reclaimStuckSending } from "@/lib/notifications/dispatch";

// Machine-to-machine — no auth() session. Vercel Cron sends CRON_SECRET as a
// Bearer token (also accepts ?token= for manual/local runs). The durable
// backstop for the post-response after() drain.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  const token = request.nextUrl.searchParams.get("token");
  if (!secret || (header !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reclaimed = await reclaimStuckSending();
  const drain = await drainEmailQueue({ limit: 100 });
  return NextResponse.json({ reclaimed, ...drain });
}
