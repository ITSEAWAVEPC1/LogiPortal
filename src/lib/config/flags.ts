// Runtime feature flags. Read once at module load from process.env — there is
// no admin UI for these; they are deployment-level switches.

/**
 * Stage 9 — the customer portal. Default ON; set CUSTOMER_PORTAL_ENABLED=false
 * to disable the entire /portal route group and its API namespace without
 * touching the internal operations app (plan §8 Stage 9 failover requirement).
 */
export const customerPortalEnabled = process.env.CUSTOMER_PORTAL_ENABLED !== "false";
