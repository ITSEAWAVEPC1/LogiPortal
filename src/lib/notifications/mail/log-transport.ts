import type { MailMessage, MailSendResult, MailTransport } from "./transport";

// Dev default — never sends, just logs. Used whenever notificationsEmailEnabled
// is false (no RESEND_API_KEY, or the switch is off).
export class LogMailTransport implements MailTransport {
  async send(message: MailMessage): Promise<MailSendResult> {
    console.info(
      `[mail:log] to=${message.to} subject=${JSON.stringify(message.subject)} (not sent — email delivery disabled)`,
    );
    return { ok: true };
  }
}
