import type { MailMessage, MailSendResult, MailTransport } from "./transport";

// Raw fetch against the Resend REST API — no `resend` npm dependency, keeping
// package.json lean (same stance as the PDF module using @react-pdf directly).
// Only constructed when notificationsEmailEnabled is true.
export class ResendMailTransport implements MailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, error: `resend ${res.status}: ${detail.slice(0, 300)}` };
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: json.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
