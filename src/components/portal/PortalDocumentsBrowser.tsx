"use client";

import { DocumentsBrowser } from "@/app/(dashboard)/documents/_components/DocumentsBrowser";
import type { DocumentCard } from "@/components/documents/types";

// Thin client wrapper so the function props (which RSC can't send from a server
// component) are created here, client-side, and handed to the shared browser
// client→client. The portal downloads through its own isolated /api/portal
// route and links jobs to /portal/jobs.
export function PortalDocumentsBrowser({ documents }: { documents: DocumentCard[] }) {
  return (
    <DocumentsBrowser
      documents={documents}
      viewerRole="CUSTOMER"
      fileHrefFor={(d) => `/api/portal/documents/${d.id}/file`}
      jobHrefFor={(d) => `/portal/jobs/${d.jobId}`}
    />
  );
}
