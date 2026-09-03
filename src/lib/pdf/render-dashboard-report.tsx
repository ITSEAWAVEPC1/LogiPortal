import { renderToBuffer } from "@react-pdf/renderer";
import { DashboardReportDocument } from "./dashboard/DashboardReportDocument";
import type { DashboardReportData } from "./dashboard/build-dashboard-report-data";

// Isolated .tsx so the route handler (report.pdf/route.ts, which must stay
// plain .ts) never needs JSX. Test seam mirrors render-document-pdf.tsx's
// `pdfRenderer` so a verification script can force a failure.
export const dashboardPdfRenderer = {
  render: (data: DashboardReportData): Promise<Buffer> =>
    renderToBuffer(<DashboardReportDocument data={data} />),
};

export type DashboardPdfResult =
  | { ok: true; buffer: Buffer; attempts: number }
  | { ok: false; attempts: number; error: string };

const MAX_ATTEMPTS = 3;

export async function renderDashboardReportWithRetry(
  data: DashboardReportData,
): Promise<DashboardPdfResult> {
  let lastError = "Unknown render error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const buffer = await dashboardPdfRenderer.render(data);
      return { ok: true, buffer, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, attempts: MAX_ATTEMPTS, error: lastError };
}
