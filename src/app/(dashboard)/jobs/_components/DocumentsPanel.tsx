"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, DataTable, FileDropzone, Input, Modal, Select } from "@/components/ui";
import { DocumentHtmlPreview } from "@/components/documents/DocumentHtmlPreview";
import {
  DOCUMENT_KIND_LABEL,
  documentStatusVariant,
  type DocumentCard,
  type DocumentTypeOption,
} from "@/components/documents/types";
import { getDocumentAccess, canCreateDocument } from "@/lib/permissions/document-access";
import { ACCEPTED_UPLOAD_ACCEPT } from "@/lib/validation/document";
import type { Role } from "@/lib/permissions/roles";
import type { DocumentPdfData } from "@/lib/pdf/types";

interface Props {
  jobId: string;
  viewerRole: Role;
  viewerId: string;
  focusStepId?: string | null;
}

export function DocumentsPanel({ jobId, viewerRole, viewerId, focusStepId }: Props) {
  const access = getDocumentAccess(viewerRole);
  const [docs, setDocs] = useState<DocumentCard[]>([]);
  const [types, setTypes] = useState<DocumentTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepFilter, setStepFilter] = useState<string | null>(focusStepId ?? null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [versionsFor, setVersionsFor] = useState<DocumentCard | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<DocumentPdfData | null>(null);

  const load = useCallback(async () => {
    const [dRes, tRes] = await Promise.all([
      fetch(`/api/documents?jobId=${jobId}`),
      fetch(`/api/document-types`),
    ]);
    const dBody = await dRes.json().catch(() => ({}));
    const tBody = await tRes.json().catch(() => ({}));
    if (!dRes.ok) {
      setError(dBody.error ?? "Failed to load documents");
      setLoading(false);
      return;
    }
    setDocs((dBody.documents ?? []) as DocumentCard[]);
    setTypes((tBody.documentTypes ?? []) as DocumentTypeOption[]);
    setError(null);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const creatableTypes = useMemo(
    () => types.filter((t) => t.isActive && canCreateDocument(viewerRole, t.isFinancial)),
    [types, viewerRole],
  );
  const generatableTypes = useMemo(() => creatableTypes.filter((t) => t.isGeneratable), [creatableTypes]);

  const visibleDocs = useMemo(
    () => (stepFilter ? docs.filter((d) => d.jobWorkflowProgressId === stepFilter) : docs),
    [docs, stepFilter],
  );

  async function run(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const issues = (body.issues as { message: string }[] | undefined)?.map((i) => i.message).join("; ");
      setError(issues || body.error || "Action failed");
      return false;
    }
    await load();
    return true;
  }

  async function generate(code: string) {
    if (!code) return;
    await run(() =>
      fetch(`/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, documentTypeCode: code, jobWorkflowProgressId: stepFilter ?? undefined }),
      }),
    );
  }

  async function submitUpload() {
    if (!uploadType || !uploadFile) {
      setError("Pick a document type and a file.");
      return;
    }
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("documentTypeCode", uploadType);
    if (uploadTitle.trim()) fd.set("title", uploadTitle.trim());
    if (stepFilter) fd.set("jobWorkflowProgressId", stepFilter);
    fd.set("file", uploadFile);
    const ok = await run(() => fetch(`/api/documents`, { method: "POST", body: fd }));
    if (ok) {
      setUploadOpen(false);
      setUploadType("");
      setUploadTitle("");
      setUploadFile(null);
    }
  }

  async function viewDocument(doc: DocumentCard) {
    if (!doc.currentVersionId) {
      setError("This document has no file yet.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${doc.id}/versions/${doc.currentVersionId}/file`);
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not open the file");
      setBusy(false);
      return;
    }
    if (ctype.includes("application/json")) {
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      if (body?.fallback && body.data) {
        setPreview(body.data as DocumentPdfData);
        return;
      }
      setError("File is unavailable.");
      return;
    }
    const blob = await res.blob();
    setBusy(false);
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function addUploadedVersion() {
    if (!versionsFor || !newVersionFile) return;
    const fd = new FormData();
    fd.set("file", newVersionFile);
    const ok = await run(() =>
      fetch(`/api/documents/${versionsFor.id}/versions`, { method: "POST", body: fd }),
    );
    if (ok) {
      setNewVersionFile(null);
      setVersionsFor(null);
    }
  }

  async function openVersions(doc: DocumentCard) {
    const res = await fetch(`/api/documents/${doc.id}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setVersionsFor(body.document as DocumentCard);
  }

  const isAdmin = viewerRole === "ADMIN";
  const ownedByViewer = (d: DocumentCard) => d.createdBy?.id === viewerId;

  function rowActions(d: DocumentCard) {
    const canSubmit =
      (d.status === "DRAFT" || d.status === "REJECTED") &&
      (isAdmin || (access.canEditMeta && ownedByViewer(d)));
    const canReview = access.canApprove && (d.status === "DRAFT" || d.status === "PENDING_APPROVAL");
    const canShare = access.canShareToggle && d.status === "APPROVED";
    const canRegen = d.origin === "GENERATED" && (isAdmin || (access.canEditMeta && ownedByViewer(d)));

    return (
      <div className="flex flex-wrap justify-end gap-1">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => viewDocument(d)}>
          View
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => openVersions(d)}>
          v{d.currentVersionNumber}
        </Button>
        {canRegen && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(() =>
                fetch(`/api/documents/${d.id}/versions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode: "regenerate" }),
                }),
              )
            }
          >
            Regenerate
          </Button>
        )}
        {canSubmit && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => fetch(`/api/documents/${d.id}/submit`, { method: "POST" }))}
          >
            Submit
          </Button>
        )}
        {canReview && (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(() =>
                  fetch(`/api/documents/${d.id}/review`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "approve" }),
                  }),
                )
              }
            >
              Approve
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setRejectFor(d.id)}>
              Reject
            </Button>
          </>
        )}
        {canShare && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(() =>
                fetch(`/api/documents/${d.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sharedWithCustomer: !d.sharedWithCustomer }),
                }),
              )
            }
          >
            {d.sharedWithCustomer ? "Unshare" : "Share"}
          </Button>
        )}
        {isAdmin && d.isActive && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(() =>
                fetch(`/api/documents/${d.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                }),
              )
            }
          >
            Deactivate
          </Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <Card id="job-documents">
        <p className="text-sm text-text-secondary">Loading documents…</p>
      </Card>
    );
  }

  return (
    <Card id="job-documents">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Documents</h2>
          <p className="text-xs text-text-tertiary">
            HBL / MBL / Freight Certificate / Delivery Order / Invoice — generated or uploaded, versioned, approved by the
            Branch Manager.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {generatableTypes.length > 0 && (
            <Select
              aria-label="Generate document"
              placeholder="Generate…"
              options={generatableTypes.map((t) => ({ value: t.code, label: t.name }))}
              value=""
              onChange={(e) => generate(e.target.value)}
              disabled={busy}
            />
          )}
          {creatableTypes.length > 0 && (
            <Button size="sm" disabled={busy} onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
          )}
        </div>
      </div>

      {stepFilter && (
        <p className="mb-2 text-xs text-text-secondary">
          Filtered to one workflow step ·{" "}
          <button type="button" className="underline" onClick={() => setStepFilter(null)}>
            show all
          </button>
        </p>
      )}

      {error && <p className="mb-3 text-sm text-status-danger-fg">{error}</p>}

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
                  {d.currentGenerationStatus === "FAILED" ? " · render failed (HTML fallback)" : ""}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (d: DocumentCard) => (
              <div className="flex flex-col gap-1">
                <Badge variant={documentStatusVariant(d.status)}>{d.status.replace(/_/g, " ")}</Badge>
                {d.sharedWithCustomer && <Badge variant="success">Shared</Badge>}
                {!d.isActive && <Badge variant="neutral">Inactive</Badge>}
              </div>
            ),
          },
          { key: "actions", header: "", render: rowActions },
        ]}
        data={visibleDocs}
        getRowKey={(d) => d.id}
        emptyMessage="No documents for this job yet."
      />

      {/* Upload modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload a document">
        <div className="flex flex-col gap-3">
          <Select
            label="Document type"
            placeholder="Select…"
            options={creatableTypes.map((t) => ({ value: t.code, label: t.name }))}
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
          />
          <Input label="Title (optional)" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
          <FileDropzone
            accept={ACCEPTED_UPLOAD_ACCEPT}
            hint="PDF, PNG or JPG · max 10MB"
            onFileSelected={setUploadFile}
          />
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={submitUpload}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={rejectFor !== null} onClose={() => setRejectFor(null)} title="Reject this document">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!rejectFor || !rejectNote.trim()) return;
            const ok = await run(() =>
              fetch(`/api/documents/${rejectFor}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject", note: rejectNote.trim() }),
              }),
            );
            if (ok) {
              setRejectFor(null);
              setRejectNote("");
            }
          }}
          className="flex flex-col gap-3"
        >
          <Input
            label="Reason"
            required
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="What needs to change before this can be approved?"
          />
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejectFor(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              Reject
            </Button>
          </div>
        </form>
      </Modal>

      {/* Version history modal */}
      <Modal
        open={versionsFor !== null}
        onClose={() => {
          setVersionsFor(null);
          setNewVersionFile(null);
        }}
        title={versionsFor ? `${versionsFor.title} — versions` : "Versions"}
      >
        <div className="flex flex-col gap-3">
          {(versionsFor?.versions ?? []).map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-border-subtle pb-2 text-sm">
              <div>
                <p className="font-medium text-text-primary">
                  v{v.versionNumber} {v.isCurrent && <span className="text-xs text-brand-teal">· current</span>}
                </p>
                <p className="text-xs text-text-tertiary">
                  {v.generationStatus === "FAILED"
                    ? `render failed after ${v.generationAttempts} attempts`
                    : v.generationStatus === "SUCCEEDED"
                      ? `generated (${v.generationAttempts} attempt${v.generationAttempts === 1 ? "" : "s"})`
                      : "uploaded"}
                  {" · "}
                  {new Date(v.createdAt).toLocaleString()}
                  {v.createdBy ? ` · ${v.createdBy.name}` : ""}
                </p>
              </div>
              {versionsFor && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    window.open(`/api/documents/${versionsFor.id}/versions/${v.id}/file`, "_blank")
                  }
                >
                  Open
                </Button>
              )}
            </div>
          ))}

          {versionsFor &&
            (isAdmin || (access.canEditMeta && versionsFor.createdBy?.id === viewerId)) && (
              <div className="mt-1">
                <p className="mb-1 text-xs font-medium uppercase text-text-tertiary">Add a new version</p>
                <FileDropzone
                  accept={ACCEPTED_UPLOAD_ACCEPT}
                  hint="Uploading a new file supersedes the current version and resets approval"
                  onFileSelected={setNewVersionFile}
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" disabled={busy || !newVersionFile} onClick={addUploadedVersion}>
                    Upload new version
                  </Button>
                </div>
              </div>
            )}
        </div>
      </Modal>

      {/* HTML fallback preview */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Document preview" className="lg:max-w-3xl">
        {preview && <DocumentHtmlPreview data={preview} />}
      </Modal>
    </Card>
  );
}
