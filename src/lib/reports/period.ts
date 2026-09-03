// Stage 10b — reporting date windows. The company operates in India; all
// period boundaries are Asia/Kolkata (UTC+5:30, no DST) midnights, returned as
// UTC Date instances for Prisma. Windows are half-open: [gte, lt).

const IST_MS = 5.5 * 60 * 60 * 1000;

export type PeriodKey = "YTD" | "MTD" | "WTD" | "CUSTOM";

export interface Period {
  gte: Date;
  lt: Date;
  label: string;
  key: PeriodKey;
}

function parseYmd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

/** IST calendar-date midnight expressed as a UTC Date. */
function istMidnightUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - IST_MS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolvePeriod(key: string, from?: string, to?: string): Period {
  const nowIst = new Date(Date.now() + IST_MS);
  const y = nowIst.getUTCFullYear();
  const m = nowIst.getUTCMonth();
  const d = nowIst.getUTCDate();
  // exclusive upper bound = the start of "tomorrow" in IST
  const endExclusive = new Date(istMidnightUtc(y, m, d).getTime() + DAY_MS);

  if (key === "CUSTOM") {
    const f = from ? parseYmd(from) : null;
    if (f) {
      const gte = istMidnightUtc(...f);
      const t = to ? parseYmd(to) : null;
      const lt = t ? new Date(istMidnightUtc(...t).getTime() + DAY_MS) : endExclusive;
      return { gte, lt, label: `${from} → ${to ?? "today"}`, key: "CUSTOM" };
    }
    // malformed custom range falls back to YTD
  }

  if (key === "MTD") {
    return { gte: istMidnightUtc(y, m, 1), lt: endExclusive, label: "Month to date", key: "MTD" };
  }

  if (key === "WTD") {
    const dow = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 Sun … 6 Sat
    const backToMonday = (dow + 6) % 7;
    return {
      gte: istMidnightUtc(y, m, d - backToMonday),
      lt: endExclusive,
      label: "Week to date",
      key: "WTD",
    };
  }

  return { gte: istMidnightUtc(y, 0, 1), lt: endExclusive, label: "Year to date", key: "YTD" };
}

export interface MonthBucket {
  key: string; // "2026-04"
  label: string; // "Apr 2026"
  gte: Date;
  lt: Date;
}

/** Whole IST calendar months starting within [gte, lt), oldest first (cap 36). */
export function monthBuckets(gte: Date, lt: Date): MonthBucket[] {
  const startIst = new Date(gte.getTime() + IST_MS);
  let y = startIst.getUTCFullYear();
  let m = startIst.getUTCMonth();
  const out: MonthBucket[] = [];
  for (let i = 0; i < 36; i++) {
    const bGte = istMidnightUtc(y, m, 1);
    if (bGte >= lt) break;
    out.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      gte: bGte,
      lt: istMidnightUtc(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1),
    });
    if (m === 11) {
      m = 0;
      y++;
    } else {
      m++;
    }
  }
  return out;
}

export function bucketKeyForDate(dt: Date): string {
  const ist = new Date(dt.getTime() + IST_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}
