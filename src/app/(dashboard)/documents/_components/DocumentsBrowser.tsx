"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, DataTable, Input, Select } from "@/components/ui";
import {
  DOCUMENT_KIND_LABEL,
  documentStatusVariant,
  type DocumentCard,
  type DocumentKindValue,
} from "@/components/documents/types";
import { DOCUMENT_STATUS_OPTIONS } from "@/lib/validation/document";

const KIND_OPTIONS = (Object.keys(DOCUMENT_KIND_LABEL) as DocumentKindValue[]).map((k) => ({
  value: k,
  label: DOCUMENT_KIND_LABEL[k],
}));

export function DocumentsBrowser({
  documents,
  viewerRole,
}: {
  documents: DocumentCard[];
  viewerRole: string;
}) {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (kind && d.kind !== kind) return false;
      if (status && d.status !== status) return false;
      if (needle && !`${d.jobRef} ${d.title} ${d.ref} ${d.organizationName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [documents, kind, status, q]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-text-primary">Documents</h1>
        <p className="text-sm text-text-secondary">
          {viewerRole === "CUSTOMER"
            ? "Approved documents shared with your organisation."
            : "All job documents you can access. Generate, upload and approve from the job page."}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Search job ref, title, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          placeholder="All kinds"
          options={KIND_OPTIONS}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        />
        <Select
          placeholder="All statuses"
          options={DOCUMENT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      <Card>
        <DataTable
          columns={[
            {
              key: "title",
              header: "Document",
              render: (d: DocumentCard) => (
                <div>
                  <p className="font-medium text-text-primary">{d.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {d.ref} · {DOCUMENT_KIND_LABEL[d.kind]} · {d.origin === "GENERATED" ? "Generated" : "Uploaded"}
                  </p>
                </div>
              ),
            },
            {
              key: "job",
              header: "Job",
              render: (d: DocumentCard) => (
                <Link href={`/jobs/${d.jobId}`} className="text-brand-teal underline">
                  {d.jobRef}
                </Link>
              ),
            },
            { key: "org", header: "Customer", render: (d: DocumentCard) => d.organizationName },
            {
              key: "status",
              header: "Status",
              render: (d: DocumentCard) => (
                <div className="flex flex-col gap-1">
                  <Badge variant={documentStatusVariant(d.status)}>{d.status.replace(/_/g, " ")}</Badge>
                  {d.sharedWithCustomer && <Badge variant="success">Shared</Badge>}
                </div>
              ),
            },
            {
              key: "updated",
              header: "Updated",
              render: (d: DocumentCard) => new Date(d.updatedAt).toLocaleDateString(),
            },
            {
              key: "open",
              header: "",
              render: (d: DocumentCard) =>
                d.currentVersionId ? (
                  <a
                    href={`/api/documents/${d.id}/versions/${d.currentVersionId}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-teal underline"
                  >
                    View v{d.currentVersionNumber}
                  </a>
                ) : (
                  <span className="text-xs text-text-tertiary">—</span>
                ),
            },
          ]}
          data={rows}
          getRowKey={(d) => d.id}
          emptyMessage="No documents match."
        />
      </Card>
    </div>
  );
}
