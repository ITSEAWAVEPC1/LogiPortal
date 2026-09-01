"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button, Card, DataTable, FileDropzone, Select, StepTracker } from "@/components/ui";
import type { Step } from "@/components/ui/StepTracker";
import { type ImportEntity, targetFieldsFor } from "@/lib/import/entity-config";
import type { ValidationResult } from "@/lib/import/validate-customer-rows";

type WizardStep = "upload" | "map" | "validate" | "summary";

interface CommitResult {
  status: string;
  importedRows: number;
  invalidRows: number;
  totalRows: number;
  id: string;
}

const STEP_ORDER: { key: WizardStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map Columns" },
  { key: "validate", label: "Validate" },
  { key: "summary", label: "Summary" },
];

export function ImportWizard({ entityType = "CUSTOMER" }: { entityType?: ImportEntity }) {
  const router = useRouter();
  const targetFields = useMemo(() => targetFieldsFor(entityType), [entityType]);
  const previewField = useMemo(() => targetFields.find((f) => f.required) ?? targetFields[0], [targetFields]);
  const [step, setStep] = useState<WizardStep>("upload");
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function steps(): Step[] {
    const currentIndex = STEP_ORDER.findIndex((s) => s.key === step);
    return STEP_ORDER.map((s, i) => ({
      id: s.key,
      label: s.label,
      status: i < currentIndex ? "completed" : i === currentIndex ? "active" : "pending",
    }));
  }

  function reset() {
    setStep("upload");
    setImportBatchId(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setValidation(null);
    setCommitResult(null);
    setError(null);
  }

  async function handleFileSelected(file: File) {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);

    const res = await fetch("/api/data-import/upload", { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Upload failed");
      return;
    }

    setImportBatchId(body.importBatchId);
    setHeaders(body.headers);
    setRows(body.rows);
    setMapping(body.suggestedMapping);
    setStep("map");
  }

  async function handleValidate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/data-import/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, mapping, entityType }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Validation failed");
      return;
    }

    setValidation(body);
    setStep("validate");
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/data-import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importBatchId, rows, mapping, entityType }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Import failed");
      setCommitResult(body.importBatch);
      setStep("summary");
      return;
    }

    setCommitResult(body.importBatch);
    setStep("summary");
    router.refresh();
  }

  return (
    <Card>
      <div className="mb-6">
        <StepTracker steps={steps()} orientation="horizontal" />
      </div>

      {error && <p className="mb-4 text-sm text-status-danger-fg">{error}</p>}

      {step === "upload" && (
        <FileDropzone
          onFileSelected={handleFileSelected}
          accept=".xlsx,.xls,.csv"
          label={loading ? "Uploading..." : "Click to upload or drag an .xlsx / .csv file here"}
          hint="Max 5MB"
        />
      )}

      {step === "map" && (
        <div>
          <p className="mb-4 text-sm text-text-secondary">
            Match each platform field to a column in your file. Fields marked required must be mapped.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {targetFields.map((field) => (
              <Select
                key={field.key}
                label={field.label + (field.required ? " *" : "")}
                placeholder="Not mapped"
                value={mapping[field.key] ?? ""}
                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || null })}
                options={headers.map((h) => ({ value: h, label: h }))}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Start over
            </Button>
            <Button
              onClick={handleValidate}
              disabled={loading || targetFields.some((f) => f.required && !mapping[f.key])}
            >
              {loading ? "Validating..." : "Validate"}
            </Button>
          </div>
        </div>
      )}

      {step === "validate" && validation && (
        <div>
          <div className="mb-4 flex gap-4">
            <Badge variant="success">{validation.validCount} valid</Badge>
            <Badge variant="danger">{validation.invalidCount} flagged</Badge>
          </div>
          {validation.invalidCount > 0 && (
            <DataTable
              columns={[
                { key: "rowNumber", header: "Row" },
                { key: "preview", header: previewField.label, render: (r) => r.mapped[previewField.key] || "—" },
                {
                  key: "errors",
                  header: "Errors",
                  render: (r) => r.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
                },
              ]}
              data={validation.rows.filter((r) => !r.valid)}
              getRowKey={(r) => String(r.rowNumber)}
            />
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep("map")}>
              Back to mapping
            </Button>
            <Button onClick={handleCommit} disabled={loading || validation.validCount === 0}>
              {loading ? "Importing..." : `Import ${validation.validCount} valid row(s)`}
            </Button>
          </div>
        </div>
      )}

      {step === "summary" && commitResult && (
        <div>
          <p className="mb-2 text-sm text-text-primary">
            Batch <span className="font-medium">{commitResult.status}</span>.
          </p>
          <div className="mb-4 flex gap-4">
            <Badge variant="success">{commitResult.importedRows} imported</Badge>
            <Badge variant={commitResult.invalidRows > 0 ? "danger" : "neutral"}>
              {commitResult.invalidRows} flagged
            </Badge>
          </div>
          {commitResult.invalidRows > 0 && importBatchId && (
            <a
              href={`/api/data-import/${importBatchId}/errors`}
              className="text-sm font-medium text-brand-teal hover:underline"
            >
              Download error report (CSV)
            </a>
          )}
          <div className="mt-6 flex justify-end">
            <Button onClick={reset}>Start new import</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
