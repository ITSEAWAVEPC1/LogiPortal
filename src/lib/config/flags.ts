// Runtime feature flags. Read once at module load from process.env — there is
// no admin UI for these; they are deployment-level switches.

/**
 * Stage 9 — the customer portal. Default ON; set CUSTOMER_PORTAL_ENABLED=false
 * to disable the entire /portal route group and its API namespace without
 * touching the internal operations app (plan §8 Stage 9 failover requirement).
 */
export const customerPortalEnabled = process.env.CUSTOMER_PORTAL_ENABLED !== "false";

/**
 * Stage 10c — email delivery of notifications. OFF unless BOTH the switch is on
 * and a Resend key is present. When off, Notification rows are still created
 * (in-app), just marked emailStatus = SKIPPED and never dispatched.
 */
export const notificationsEmailEnabled =
  process.env.NOTIFICATIONS_EMAIL_ENABLED === "true" && !!process.env.RESEND_API_KEY;
