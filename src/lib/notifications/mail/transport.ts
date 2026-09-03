// Stage 10c — mail transport seam. One interface, swapped at src/lib/
// notifications/mail/index.ts (modelled on src/lib/pdf/document-storage.ts).

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type MailSendResult = { ok: true; id?: string } | { ok: false; error: string };

export interface MailTransport {
  send(message: MailMessage): Promise<MailSendResult>;
}
