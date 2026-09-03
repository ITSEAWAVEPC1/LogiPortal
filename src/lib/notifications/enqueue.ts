// Stage 10c — turn NotificationInput[] into rows. Applies each recipient's
// NotificationPreference (mute-by-type, in-app off, email off) and sets the
// initial emailStatus. Wrapped so it never throws into the caller — a
// notification failure must never break a workflow action.

import { prisma } from "@/lib/db/prisma";
import { notificationsEmailEnabled } from "@/lib/config/flags";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationInput } from "./events";

export async function enqueueNotifications(inputs: NotificationInput[]): Promise<number> {
  try {
    if (inputs.length === 0) return 0;
    const userIds = [...new Set(inputs.map((i) => i.userId))];
    const [prefs, users] = await Promise.all([
      prisma.notificationPreference.findMany({ where: { userId: { in: userIds } } }),
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
    ]);
    const prefByUser = new Map(prefs.map((p) => [p.userId, p]));
    const emailByUser = new Map(users.map((u) => [u.id, u.email]));

    const rows: Prisma.NotificationCreateManyInput[] = [];
    for (const input of inputs) {
      const pref = prefByUser.get(input.userId);
      const mutedTypes = Array.isArray(pref?.mutedTypes) ? (pref.mutedTypes as string[]) : [];
      if (mutedTypes.includes(input.type)) continue;
      if (pref && pref.inAppEnabled === false) continue;

      const emailEnabled = pref ? pref.emailEnabled : true;
      const hasEmail = !!emailByUser.get(input.userId);
      const emailStatus =
        notificationsEmailEnabled && emailEnabled && hasEmail ? "PENDING" : "SKIPPED";

      rows.push({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkPath: input.linkPath ?? null,
        data: input.data ?? undefined,
        emailStatus,
      });
    }

    if (rows.length === 0) return 0;
    const res = await prisma.notification.createMany({ data: rows });
    return res.count;
  } catch (e) {
    console.error("[notifications] enqueue failed", e);
    return 0;
  }
}
