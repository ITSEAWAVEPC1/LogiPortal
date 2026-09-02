import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentPdfData } from "./types";
import { HblDocument } from "./documents/HblDocument";
import { MblDocument } from "./documents/MblDocument";
import { FreightCertificateDocument } from "./documents/FreightCertificateDocument";
import { DeliveryOrderDocument } from "./documents/DeliveryOrderDocument";
import { InvoiceDocument } from "./documents/InvoiceDocument";

// Isolated .tsx so the route handlers (which must stay .ts per Next's Route
// Handler file convention) never need JSX — they call these functions with
// plain data.

// Test seam: the verification script overrides this to force generation
// failures without touching @react-pdf internals.
export const pdfRenderer = {
  render: (data: DocumentPdfData, draft: boolean): Promise<Buffer> => {
    switch (data.kind) {
      case "HBL":
        return renderToBuffer(<HblDocument data={data} draft={draft} />);
      case "MBL":
        return renderToBuffer(<MblDocument data={data} draft={draft} />);
      case "FREIGHT_CERTIFICATE":
        return renderToBuffer(<FreightCertificateDocument data={data} draft={draft} />);
      case "DELIVERY_ORDER":
        return renderToBuffer(<DeliveryOrderDocument data={data} draft={draft} />);
      case "INVOICE":
        return renderToBuffer(<InvoiceDocument data={data} draft={draft} />);
    }
  },
};

export function renderDocumentPdf(data: DocumentPdfData, draft = true): Promise<Buffer> {
  return pdfRenderer.render(data, draft);
}

export type GenerateResult =
  | { ok: true; buffer: Buffer; attempts: number }
  | { ok: false; attempts: number; error: string };

const MAX_ATTEMPTS = 3;

// Plan failover: "async generation with retry (3 attempts)". No queue infra
// yet, so this is a synchronous in-request loop; a FAILED result makes the
// caller store the version with no bytes and the client falls back to
// DocumentHtmlPreview (same shape via sourceSnapshot).
export async function generateDocumentPdfWithRetry(data: DocumentPdfData, draft = true): Promise<GenerateResult> {
  let lastError = "Unknown render error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const buffer = await renderDocumentPdf(data, draft);
      return { ok: true, buffer, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, attempts: MAX_ATTEMPTS, error: lastError };
}
