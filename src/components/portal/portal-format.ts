// Pure presentation helpers shared by the portal pages. No "use client" — safe
// in server components.

type BadgeVariant = "success" | "warning" | "danger" | "active" | "pending" | "neutral";

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function jobStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "WORKFLOW_IN_PROGRESS":
      return "active";
    case "CANCELLED":
      return "danger";
    case "NEEDS_CORRECTION":
      return "warning";
    default:
      return "pending";
  }
}

export function quotationStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "APPROVED":
    case "CUSTOMER_APPROVED":
    case "CONVERTED":
      return "success";
    case "SENT":
      return "active";
    case "NEEDS_CORRECTION":
      return "warning";
    default:
      return "pending";
  }
}

export function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "—";
  const code = (currency ?? "").trim();
  try {
    return new Intl.NumberFormat("en-IN", {
      style: code ? "currency" : "decimal",
      currency: code || undefined,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code ? `${code} ` : ""}${amount.toLocaleString("en-IN")}`;
  }
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
