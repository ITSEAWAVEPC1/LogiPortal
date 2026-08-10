export interface TargetField {
  key: string;
  label: string;
  required?: boolean;
  synonyms: string[];
}

// The fixed, small target field set for Customer import — a synonym
// dictionary + light fuzzy matching is enough here; a matching library would
// be overkill for ~9 fixed targets.
export const CUSTOMER_TARGET_FIELDS: TargetField[] = [
  {
    key: "name",
    label: "Customer Name",
    required: true,
    synonyms: ["customer name", "company name", "name", "customer", "client name", "organisation", "organization"],
  },
  { key: "contactPersonName", label: "Contact Person", synonyms: ["contact person", "contact name", "contact"] },
  { key: "contactPersonPhone", label: "Phone", synonyms: ["phone", "mobile", "contact number", "phone number"] },
  { key: "contactPersonEmail", label: "Email", synonyms: ["email", "email address", "e mail"] },
  { key: "city", label: "City", synonyms: ["city"] },
  { key: "state", label: "State", synonyms: ["state", "province"] },
  { key: "gstNumber", label: "GST Number", synonyms: ["gst", "gst number", "gstin", "gst no"] },
  { key: "panNumber", label: "PAN Number", synonyms: ["pan", "pan number", "pan no"] },
  { key: "tanNumber", label: "TAN Number", synonyms: ["tan", "tan number", "tan no"] },
];

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Suggests the best-matching source header for each target field. */
export function suggestColumnMapping(headers: string[]): Record<string, string | null> {
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  const mapping: Record<string, string | null> = {};

  for (const field of CUSTOMER_TARGET_FIELDS) {
    let best: { header: string; score: number } | null = null;

    for (const { original, normalized } of normalizedHeaders) {
      let score: number;
      if (field.synonyms.includes(normalized)) {
        score = 1;
      } else if (field.synonyms.some((s) => normalized.includes(s) || s.includes(normalized))) {
        score = 0.85;
      } else {
        score = Math.max(...field.synonyms.map((s) => similarity(normalized, s)));
      }

      if (!best || score > best.score) best = { header: original, score };
    }

    mapping[field.key] = best && best.score >= 0.6 ? best.header : null;
  }

  return mapping;
}
