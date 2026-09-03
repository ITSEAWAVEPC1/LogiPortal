// Stage 10c — email outbox drain. The Notification.email* columns are the
// queue. Called post-response from fireAfterResponse() (small limit) and, as a
// durability backstop, from GET /api/cron/notifications (larger limit).
//
// Double-send safety: rows are CLAIMED (PENDING -> SENDING) with an
// attempt-guarded updateMany, and only rows this call actually flipped are
// processed. reclaimStuckSending() rescues rows stuck in SENDING (a crashed
// drain) after 10 minutes.

import { prisma } from "@/lib/db/prisma";
import { getMailTransport } from "./mail";
import { renderEmail } from "./mail/templates";

const MAX_ATTEMPTS = 5;
const STALE_SENDING_MS = 10 * 60 * 1000;
const backoffMinutes = (attempts: number) => Math.min(60, 2 ** attempts);

function appUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function reclaimStuckSending(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SENDING_MS);
  const res = await prisma.notification.updateMany({
    where: { emailStatus: "SENDING", updatedAt: { lt: cutoff } },
    data: { emailStatus: "PENDING" },
  });
  return res.count;
}

export interface DrainResult {
  attempted: number;
  sent: number;
  failed: number;
}

export async function drainEmailQueue({ limit = 20 }: { limit?: number } = {}): Promise<DrainResult> {
  // Atomic claim: one UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
  // so two concurrent drains (after() + cron) can never claim the same row.
  const claimedIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE "notifications" SET "emailStatus" = 'SENDING', "updatedAt" = now()
     WHERE id IN (
       SELECT id FROM "notifications"
       WHERE "emailStatus" = 'PENDING'
         AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
       ORDER BY "createdAt" ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id`,
    limit,
  );
  if (claimedIds.length === 0) return { attempted: 0, sent: 0, failed: 0 };

  const ids = claimedIds.map((c) => c.id);
  const claimed = await prisma.notification.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      body: true,
      linkPath: true,
      emailAttempts: true,
      user: { select: { email: true } },
    },
  });

  const transport = getMailTransport();
  const base = appUrl();
  let sent = 0;
  let failed = 0;

  for (const n of claimed) {
    const email = n.user?.email;
    if (!email) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { emailStatus: "SKIPPED", emailError: "no recipient email" },
      });
      continue;
    }
    const mail = renderEmail({ title: n.title, body: n.body, linkPath: n.linkPath }, base);
    const result = await transport.send({ to: email, ...mail });
    if (result.ok) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { emailStatus: "SENT", emailSentAt: new Date(), nextAttemptAt: null, emailError: null },
      });
      sent++;
    } else {
      const attempts = n.emailAttempts + 1;
      const done = attempts >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          emailStatus: done ? "FAILED" : "PENDING",
          emailAttempts: attempts,
          emailError: result.error.slice(0, 500),
          nextAttemptAt: done ? null : new Date(Date.now() + backoffMinutes(attempts) * 60_000),
        },
      });
      failed++;
    }
  }

  return { attempted: claimed.length, sent, failed };
}
