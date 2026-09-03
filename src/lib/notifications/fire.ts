import { after } from "next/server";
import type { NotificationInput } from "./events";
import { enqueueNotifications } from "./enqueue";
import { drainEmailQueue } from "./dispatch";

// Stage 10c — enqueue notifications AFTER the response is sent (Next 16
// `after`), never inside the route's $transaction. A failure here can never
// block or roll back the workflow action that triggered it. The email drain
// runs with a small limit; GET /api/cron/notifications is the durable backstop.
export function fireAfterResponse(inputs: NotificationInput[]): void {
  if (inputs.length === 0) return;
  after(async () => {
    try {
      const created = await enqueueNotifications(inputs);
      if (created > 0) await drainEmailQueue({ limit: 10 });
    } catch (e) {
      console.error("[notifications] fireAfterResponse failed", e);
    }
  });
}
