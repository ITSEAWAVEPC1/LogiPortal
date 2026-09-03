import { notificationsEmailEnabled } from "@/lib/config/flags";
import type { MailTransport } from "./transport";
import { LogMailTransport } from "./log-transport";
import { ResendMailTransport } from "./resend-transport";

// The single swap point. getMailTransport() returns Resend when email is
// enabled, else the log-only transport. __setMailTransportForTest lets a
// verification script inject a stub (same seam idea as pdfRenderer).

let override: MailTransport | null = null;

export function getMailTransport(): MailTransport {
  if (override) return override;
  if (notificationsEmailEnabled) {
    return new ResendMailTransport(
      process.env.RESEND_API_KEY as string,
      process.env.NOTIFICATIONS_FROM_EMAIL || "Seawave Ops <ops@seawave.example>",
    );
  }
  return new LogMailTransport();
}

export function __setMailTransportForTest(t: MailTransport | null): void {
  override = t;
}

export type { MailMessage, MailSendResult, MailTransport } from "./transport";
