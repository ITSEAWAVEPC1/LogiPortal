// Pure cost-sheet arithmetic — no Prisma import, so CostSheetEditor
// ("use client") and the API routes can both use it. Mirrors
// LineItemsEditor's computeRateInr for the buy side. All inputs accept a
// partial line object (extra fields ignored, missing ones treated as null).

export function computeBuyRateInr(input: {
  buyCurrency?: string | null;
  buyRate?: number | null;
  buyExchangeRate?: number | null;
}): number | null {
  const buyRate = input.buyRate ?? null;
  if (buyRate == null) return null;
  const currency = (input.buyCurrency ?? "INR").toUpperCase();
  if (currency === "INR") return buyRate;
  const xr = input.buyExchangeRate ?? null;
  if (xr == null) return null;
  return buyRate * xr;
}

// Additive margin: sell = buyINR * (1 + effectivePct/100) + flat.
// effectivePct = the line's own marginPct, else the sheet default, else 0.
// null only when there is nothing to base a sell rate on at all.
export function computeSellRate(input: {
  buyRateInr?: number | null;
  marginPct?: number | null;
  marginFlat?: number | null;
  defaultMarginPct?: number | null;
}): number | null {
  const buyRateInr = input.buyRateInr ?? null;
  const marginFlat = input.marginFlat ?? null;
  if (buyRateInr == null && marginFlat == null) return null;
  const base = buyRateInr ?? 0;
  const pct = input.marginPct ?? input.defaultMarginPct ?? 0;
  return base * (1 + pct / 100) + (marginFlat ?? 0);
}

export function computeAmount(input: { quantity?: number | null; sellRate?: number | null }): number {
  return (input.quantity ?? 0) * (input.sellRate ?? 0);
}
