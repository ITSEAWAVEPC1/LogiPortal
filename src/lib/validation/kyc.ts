import { prisma } from "@/lib/db/prisma";

// Indian GSTIN: 2-digit state code + 10-char PAN + 1-digit entity code + "Z" + 1 checksum char.
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// PAN: 5 letters + 4 digits + 1 letter.
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// TAN: 4 letters + 5 digits + 1 letter.
export const TAN_REGEX = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

export function normalizeGst(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePan(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeTan(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGst(value: string): boolean {
  return GST_REGEX.test(normalizeGst(value));
}

export function isValidPan(value: string): boolean {
  return PAN_REGEX.test(normalizePan(value));
}

export function isValidTan(value: string): boolean {
  return TAN_REGEX.test(normalizeTan(value));
}

/**
 * Section 5.1: "duplicate GST number blocked with a warning pointing to the
 * existing record." Looked up against KycDetail (unique-if-present), not
 * Organization, since GST lives there.
 */
export async function findDuplicateGst(gst: string, excludeOrganizationId?: string) {
  const normalized = normalizeGst(gst);
  const existing = await prisma.kycDetail.findUnique({
    where: { gstNumber: normalized },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!existing || existing.organizationId === excludeOrganizationId) return null;
  return existing.organization;
}
