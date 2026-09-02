import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Unified RFQ reference number — RFQ-DDMMYY-NNNN
//
// One identifier follows a shipment from Enquiry -> Quotation -> Job:
//   * Enquiry mints a fresh number here (allocateRfqReference).
//   * Its Quotation and its Job REUSE that exact string (inheritRfqReference) —
//     no counter touch.
//   * Records with no single parent Enquiry (direct Jobs, bulk-imported Jobs,
//     multi-enquiry Quotations that can't inherit) mint a fresh number too.
//
// NNNN is a per-year counter (resets each calendar year). One shared scope
// ("RFQ") across all three tables is what guarantees a freshly-minted number
// can never equal an inherited one — every fresh mint takes a distinct value.
// ---------------------------------------------------------------------------

export const RFQ_PREFIX = "RFQ";
export const RFQ_SCOPE = "RFQ";

export interface RfqReference {
  referenceNo: string;
  refYear: number;
  refSequence: number;
}

/** DDMMYY from a Date, in UTC (kept consistent across runtime, backfill, tests). */
export function ddmmyy(when: Date): string {
  const d = String(when.getUTCDate()).padStart(2, "0");
  const m = String(when.getUTCMonth() + 1).padStart(2, "0");
  const y = String(when.getUTCFullYear() % 100).padStart(2, "0");
  return `${d}${m}${y}`;
}

/** Compose the display string from its parts. */
export function formatRfqReference(when: Date, seq: number): string {
  return `${RFQ_PREFIX}-${ddmmyy(when)}-${String(seq).padStart(4, "0")}`;
}

/**
 * Mint a FRESH reference. MUST run inside a prisma.$transaction — `tx` is the
 * transactional client. The upsert compiles to
 *   INSERT ... ON CONFLICT (scope, year) DO UPDATE SET lastValue = lastValue + 1
 *   RETURNING lastValue
 * so it is atomic even for the first row of a new year, and concurrent callers
 * serialize on the counter row's write lock — no two mints ever share a value.
 */
export async function allocateRfqReference(
  tx: Prisma.TransactionClient,
  when: Date = new Date(),
): Promise<RfqReference> {
  const year = when.getUTCFullYear();
  const counter = await tx.referenceCounter.upsert({
    where: { scope_year: { scope: RFQ_SCOPE, year } },
    create: { scope: RFQ_SCOPE, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return { referenceNo: formatRfqReference(when, counter.lastValue), refYear: year, refSequence: counter.lastValue };
}

/**
 * Reserve a CONTIGUOUS block of `count` fresh references in one round trip
 * (bulk import). Returns them in ascending order. No per-row work.
 */
export async function allocateRfqReferenceBlock(
  tx: Prisma.TransactionClient,
  count: number,
  when: Date = new Date(),
): Promise<RfqReference[]> {
  if (count <= 0) return [];
  const year = when.getUTCFullYear();
  const counter = await tx.referenceCounter.upsert({
    where: { scope_year: { scope: RFQ_SCOPE, year } },
    create: { scope: RFQ_SCOPE, year, lastValue: count },
    update: { lastValue: { increment: count } },
  });
  const start = counter.lastValue - count + 1;
  return Array.from({ length: count }, (_, i) => ({
    referenceNo: formatRfqReference(when, start + i),
    refYear: year,
    refSequence: start + i,
  }));
}

/**
 * REUSE a parent's reference verbatim (Enquiry -> its Quotation / its Job).
 * Pure copy — never touches the counter. Returns null when the source has no
 * reference yet (a pre-backfill row); the caller then mints a fresh one.
 */
export function inheritRfqReference(source: {
  referenceNo: string | null;
  refYear: number | null;
  refSequence: number | null;
}): RfqReference | null {
  if (!source.referenceNo || source.refYear == null || source.refSequence == null) return null;
  return { referenceNo: source.referenceNo, refYear: source.refYear, refSequence: source.refSequence };
}
