import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/lib/permissions/roles";
import { formatJobRef } from "@/lib/validation/job";
import { formatDocumentRef } from "@/lib/validation/document";
import {
  DOCUMENT_JOB_INCLUDE,
  buildDocumentData,
  type GeneratableKind,
} from "@/lib/pdf/build-document-data";
import { generateDocumentPdfWithRetry } from "@/lib/pdf/render-document-pdf";
import { toVersionStorageFields } from "@/lib/pdf/document-storage";

const TX = { timeout: 20000, maxWait: 10000 } as const;

// Selection shared by list + detail responses. `bytes` is never selected here
// — the file only leaves via the dedicated streaming route.
export const DOCUMENT_CARD_SELECT = {
  id: true,
  sequenceNumber: true,
  jobId: true,
  kind: true,
  origin: true,
  title: true,
  isFinancial: true,
  status: true,
  sharedWithCustomer: true,
  isActive: true,
  currentVersionNumber: true,
  jobWorkflowProgressId: true,
  approvedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  documentType: { select: { code: true, name: true } },
  job: {
    select: {
      id: true,
      sequenceNumber: true,
      referenceNo: true,
      createdAt: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  },
  // Just enough to resolve the current version's id + render status for the
  // list; the detail select overrides this with the full version shape.
  versions: { select: { id: true, versionNumber: true, generationStatus: true } },
} satisfies Prisma.DocumentSelect;

const VERSION_CARD_SELECT = {
  id: true,
  versionNumber: true,
  fileName: true,
  contentType: true,
  byteSize: true,
  generationStatus: true,
  generationError: true,
  generationAttempts: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentVersionSelect;

export const DOCUMENT_DETAIL_SELECT = {
  ...DOCUMENT_CARD_SELECT,
  versions: { orderBy: { versionNumber: "desc" }, select: VERSION_CARD_SELECT },
} satisfies Prisma.DocumentSelect;

type CardRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_CARD_SELECT }>;
type DetailRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_DETAIL_SELECT }>;

export function serializeDocument(d: CardRow | DetailRow) {
  const current = d.versions.find((v) => v.versionNumber === d.currentVersionNumber) ?? null;
  const base = {
    id: d.id,
    ref: formatDocumentRef(d.createdAt, d.sequenceNumber),
    jobId: d.jobId,
    jobRef: formatJobRef(d.job),
    organizationName: d.job.organization.name,
    kind: d.kind,
    origin: d.origin,
    title: d.title,
    isFinancial: d.isFinancial,
    status: d.status,
    sharedWithCustomer: d.sharedWithCustomer,
    isActive: d.isActive,
    currentVersionNumber: d.currentVersionNumber,
    currentVersionId: current?.id ?? null,
    currentGenerationStatus: current?.generationStatus ?? null,
    jobWorkflowProgressId: d.jobWorkflowProgressId,
    documentTypeCode: d.documentType.code,
    documentTypeName: d.documentType.name,
    createdBy: d.createdBy,
    approvedBy: d.approvedBy,
    approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
    reviewNote: d.reviewNote,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
  const full = d.versions.length > 0 && "fileName" in d.versions[0];
  if (full) {
    return {
      ...base,
      versions: (d.versions as DetailRow["versions"]).map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        isCurrent: v.versionNumber === d.currentVersionNumber,
      })),
    };
  }
  return base;
}

/** CUSTOMER users are org-scoped; every other role sees across orgs. */
export async function resolveViewerOrgId(role: Role, userId: string): Promise<string | null> {
  if (role !== "CUSTOMER") return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  return u?.organizationId ?? null;
}

interface CreateGeneratedArgs {
  jobId: string;
  documentTypeId: string;
  kind: GeneratableKind;
  isFinancial: boolean;
  title: string;
  actorId: string;
  jobWorkflowProgressId?: string;
}

/**
 * Create a Document + its first (GENERATED) version. The PDF render + 3-attempt
 * retry runs inside the transaction so the Document never exists without a v1;
 * a render that fails all attempts still produces a v1 row (bytes null,
 * generationStatus FAILED) and the reader falls back to the HTML preview.
 */
export async function createGeneratedDocument(args: CreateGeneratedArgs) {
  const job = await prisma.job.findUnique({
    where: { id: args.jobId },
    include: DOCUMENT_JOB_INCLUDE,
  });
  if (!job) return { error: "job-not-found" as const };

  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        jobId: args.jobId,
        documentTypeId: args.documentTypeId,
        kind: args.kind,
        origin: "GENERATED",
        title: args.title,
        isFinancial: args.isFinancial,
        status: "DRAFT",
        currentVersionNumber: 1,
        createdById: args.actorId,
        jobWorkflowProgressId: args.jobWorkflowProgressId ?? null,
      },
    });

    const ref = formatDocumentRef(doc.createdAt, doc.sequenceNumber);
    const data = buildDocumentData(job, args.kind, ref);
    const result = await generateDocumentPdfWithRetry(data, true);

    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        sourceSnapshot: data as unknown as Prisma.InputJsonValue,
        createdById: args.actorId,
        ...(result.ok
          ? {
              ...toVersionStorageFields(result.buffer, {
                fileName: `${ref}.pdf`,
                contentType: "application/pdf",
                byteSize: result.buffer.byteLength,
              }),
              generationStatus: "SUCCEEDED",
              generationAttempts: result.attempts,
            }
          : {
              fileName: `${ref}.pdf`,
              contentType: "application/pdf",
              byteSize: 0,
              generationStatus: "FAILED",
              generationAttempts: result.attempts,
              generationError: result.error,
            }),
      },
    });

    return doc.id;
  }, TX);

  const full = await prisma.document.findUnique({ where: { id: created }, select: DOCUMENT_DETAIL_SELECT });
  return { document: full! };
}

interface CreateUploadedArgs {
  jobId: string;
  documentTypeId: string;
  kind: CardRow["kind"];
  isFinancial: boolean;
  title: string;
  actorId: string;
  jobWorkflowProgressId?: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
}

export async function createUploadedDocument(args: CreateUploadedArgs) {
  const job = await prisma.job.findUnique({ where: { id: args.jobId }, select: { id: true } });
  if (!job) return { error: "job-not-found" as const };

  const id = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        jobId: args.jobId,
        documentTypeId: args.documentTypeId,
        kind: args.kind,
        origin: "UPLOADED",
        title: args.title,
        isFinancial: args.isFinancial,
        status: "DRAFT",
        currentVersionNumber: 1,
        createdById: args.actorId,
        jobWorkflowProgressId: args.jobWorkflowProgressId ?? null,
      },
    });
    await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        createdById: args.actorId,
        generationStatus: "NOT_APPLICABLE",
        ...toVersionStorageFields(args.buffer, {
          fileName: args.fileName,
          contentType: args.contentType,
          byteSize: args.buffer.byteLength,
        }),
      },
    });
    return doc.id;
  }, TX);

  const full = await prisma.document.findUnique({ where: { id }, select: DOCUMENT_DETAIL_SELECT });
  return { document: full! };
}

/** Add a new version (regenerate from current Job data, or a fresh upload). */
export async function addDocumentVersion(
  documentId: string,
  actorId: string,
  source:
    | { mode: "regenerate" }
    | { mode: "upload"; buffer: Buffer; fileName: string; contentType: string },
) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      kind: true,
      origin: true,
      title: true,
      jobId: true,
      sequenceNumber: true,
      createdAt: true,
      currentVersionNumber: true,
      versions: { select: { versionNumber: true } },
    },
  });
  if (!doc) return { error: "not-found" as const };
  if (source.mode === "regenerate" && doc.origin !== "GENERATED") {
    return { error: "not-generatable" as const };
  }

  const highest = doc.versions.reduce((m, v) => Math.max(m, v.versionNumber), 0);
  const nextVersion = Math.max(highest, doc.currentVersionNumber) + 1;
  const ref = formatDocumentRef(doc.createdAt, doc.sequenceNumber);

  let job: Prisma.JobGetPayload<{ include: typeof DOCUMENT_JOB_INCLUDE }> | null = null;
  if (source.mode === "regenerate") {
    job = await prisma.job.findUnique({ where: { id: doc.jobId }, include: DOCUMENT_JOB_INCLUDE });
    if (!job) return { error: "job-not-found" as const };
  }

  await prisma.$transaction(async (tx) => {
    if (source.mode === "regenerate" && job) {
      const data = buildDocumentData(job, doc.kind as GeneratableKind, ref);
      const result = await generateDocumentPdfWithRetry(data, true);
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: nextVersion,
          sourceSnapshot: data as unknown as Prisma.InputJsonValue,
          createdById: actorId,
          ...(result.ok
            ? {
                ...toVersionStorageFields(result.buffer, {
                  fileName: `${ref}-v${nextVersion}.pdf`,
                  contentType: "application/pdf",
                  byteSize: result.buffer.byteLength,
                }),
                generationStatus: "SUCCEEDED",
                generationAttempts: result.attempts,
              }
            : {
                fileName: `${ref}-v${nextVersion}.pdf`,
                contentType: "application/pdf",
                byteSize: 0,
                generationStatus: "FAILED",
                generationAttempts: result.attempts,
                generationError: result.error,
              }),
        },
      });
    } else if (source.mode === "upload") {
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: nextVersion,
          createdById: actorId,
          generationStatus: "NOT_APPLICABLE",
          ...toVersionStorageFields(source.buffer, {
            fileName: source.fileName,
            contentType: source.contentType,
            byteSize: source.buffer.byteLength,
          }),
        },
      });
    }
    // A new version resets the approval state — it must be re-reviewed.
    await tx.document.update({
      where: { id: doc.id },
      data: {
        currentVersionNumber: nextVersion,
        status: "DRAFT",
        approvedById: null,
        approvedAt: null,
        reviewNote: null,
      },
    });
  }, TX);

  const full = await prisma.document.findUnique({ where: { id: doc.id }, select: DOCUMENT_DETAIL_SELECT });
  return { document: full! };
}
