import type { Notification } from "@/generated/prisma/client";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

// The Notification's title + body are already composed per-type by
// src/lib/notifications/events.ts; the email just wraps them in the brand
// shell. Every interpolated value is HTML-escaped.
export function renderEmail(
  n: Pick<Notification, "title" | "body" | "linkPath">,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const link = n.linkPath ? `${appUrl}${n.linkPath}` : appUrl;
  const text = `${n.title}\n\n${n.body}\n\n${link}\n\n—\nChange what you get emailed: ${appUrl}/settings/notifications`;
  const html = `<!doctype html><html><body style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#2b2a26;background:#f7f4ef;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e1d8;border-radius:8px;padding:24px">
    <p style="font-weight:700;color:#2fa8b5;margin:0 0 12px">Seawave Forwarding &amp; Logistics</p>
    <h1 style="font-size:16px;margin:0 0 8px">${esc(n.title)}</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px">${esc(n.body)}</p>
    <a href="${esc(link)}" style="display:inline-block;background:#2fa8b5;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:14px">Open in Seawave</a>
    <p style="font-size:11px;color:#a6a192;margin:16px 0 0">Change what you get emailed at ${esc(appUrl)}/settings/notifications</p>
  </div></body></html>`;
  return { subject: n.title, html, text };
}
