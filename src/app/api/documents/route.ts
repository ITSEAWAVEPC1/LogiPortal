import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/capabilities";
import { buildDocumentListWhere, canCreateDocument } from "@/lib/permissions/document-access";
import {
  ACCEPTED_UPLOAD_TYPES,
  MAX_DOCUMENT_FILE_SIZE,
  documentGenerateSchema,
  documentUploadMetaSchema,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
} from "@/lib/validation/document";
import type { GeneratableKind } from "@/lib/pdf/build-document-data";
import {
  DOCUMENT_CARD_SELECT,
  createGeneratedDocument,
  createUploadedDocument,
  resolveViewerOrgId,
  serializeDocument,
} from "@/lib/documents/document-service";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: userId } = session.user;
  if (!can(role, "documents", "view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const extra: Prisma.DocumentWhereInput = {};
  const jobId = sp.get("jobId");
  const kind = sp.get("kind");
  const status = sp.get("status");
  if (jobId) extra.jobId = jobId;
  if (kind && (DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    extra.kind = kind as (typeof DOCUMENT_KINDS)[number];
  }
  if (status && (DOCUMENT_STATUSES as readonly string[]).includes(status)) {
    extra.status = status as (typeof DOCUMENT_STATUSES)[number];
  }

  const orgId = await resolveViewerOrgId(role, userId);
  const where = buildDocumentListWhere(role, orgId, extra);

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_CARD_SELECT,
  });

  return NextResponse.json({ documents: documents.map(serializeDocument), viewerRole: role });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, id: actorId } = session.user;
  if (!can(role, "documents", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = request.headers.get("content-type") ?? "";
  const isUpload = contentType.includes("multipart/form-data");

  // Resolve the requested Document Type first (shared by both modes).
  let typeCode: string;
  let jobId: string;
  let title: string | undefined;
  let jobWorkflowProgressId: string | undefined;
  let uploadFile: File | null = null;

  if (isUpload) {
    const form = await request.formData();
    const parsed = documentUploadMetaSchema.safeParse({
      jobId: form.get("jobId"),
      documentTypeCode: form.get("documentTypeCode"),
      jobWorkflowProgressId: form.get("jobWorkflowProgressId") || undefined,
      title: form.get("title") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const f = form.get("file");
    if (!(f instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (f.size > MAX_DOCUMENT_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
    if (f.type && !ACCEPTED_UPLOAD_TYPES.includes(f.type)) {
      return NextResponse.json({ error: "Only PDF, PNG or JPG files are accepted" }, { status: 400 });
    }
    uploadFile = f;
    typeCode = parsed.data.documentTypeCode;
    jobId = parsed.data.jobId;
    title = parsed.data.title;
    jobWorkflowProgressId = parsed.data.jobWorkflowProgressId;
  } else {
    const parsed = documentGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    typeCode = parsed.data.documentTypeCode;
    jobId = parsed.data.jobId;
    title = parsed.data.title;
    jobWorkflowProgressId = parsed.data.jobWorkflowProgressId;
  }

  const type = await prisma.documentType.findUnique({ where: { code: typeCode } });
  if (!type || !type.isActive) {
    return NextResponse.json({ error: "Unknown or inactive document type" }, { status: 400 });
  }
  if (!isUpload && !type.isGeneratable) {
    return NextResponse.json({ error: `${type.name} is upload-only — there is no PDF template for it` }, { status: 400 });
  }
  if (!canCreateDocument(role, type.isFinancial)) {
    return NextResponse.json(
      { error: `Your role cannot create ${type.isFinancial ? "financial " : ""}documents` },
      { status: 403 },
    );
  }

  // Guard the optional workflow-step link belongs to the same job.
  if (jobWorkflowProgressId) {
    const step = await prisma.jobWorkflowProgress.findUnique({
      where: { id: jobWorkflowProgressId },
      select: { jobId: true },
    });
    if (!step || step.jobId !== jobId) {
      return NextResponse.json({ error: "Workflow step does not belong to this job" }, { status: 400 });
    }
  }

  const resolvedTitle = title ?? type.name;

  if (isUpload && uploadFile) {
    const buffer = Buffer.from(await uploadFile.arrayBuffer());
    const result = await createUploadedDocument({
      jobId,
      documentTypeId: type.id,
      kind: type.kind,
      isFinancial: type.isFinancial,
      title: resolvedTitle,
      actorId,
      jobWorkflowProgressId,
      buffer,
      fileName: uploadFile.name || `${resolvedTitle}`,
      contentType: uploadFile.type || "application/octet-stream",
    });
    if ("error" in result) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ document: serializeDocument(result.document) }, { status: 201 });
  }

  const result = await createGeneratedDocument({
    jobId,
    documentTypeId: type.id,
    kind: type.kind as GeneratableKind,
    isFinancial: type.isFinancial,
    title: resolvedTitle,
    actorId,
    jobWorkflowProgressId,
  });
  if ("error" in result) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const doc = serializeDocument(result.document);
  const v1 = "versions" in doc ? doc.versions.find((v) => v.versionNumber === 1) : undefined;
  return NextResponse.json(
    { document: doc, generation: v1 ? { status: v1.generationStatus, attempts: v1.generationAttempts } : null },
    { status: 201 },
  );
}
