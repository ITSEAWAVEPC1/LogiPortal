import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationDocument } from "./QuotationDocument";
import type { QuotationPdfData } from "./types";

// Isolated in its own .tsx module so the route handler (route.ts, which must
// stay plain .ts per Next's Route Handler file convention) never needs JSX —
// it just calls this function with plain data.
export async function renderQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />);
}
