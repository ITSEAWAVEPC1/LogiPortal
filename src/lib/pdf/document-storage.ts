import { prisma } from "@/lib/db/prisma";

// Storage indirection for document file bytes.
//
// Today: the Postgres `DocumentVersion.bytes` column (decision confirmed with
// the user — no new dependency or token, identical local/deployed, fine at
// this scale). A later swap to Vercel Blob changes only this file: `write`
// becomes `put(...)` returning a key, `read` becomes `fetch(url)`. Callers
// keep dealing in { fileName, contentType, byteSize } + a versionId.

export interface StoredFileMeta {
  fileName: string;
  contentType: string;
  byteSize: number;
}

/**
 * The create-payload fragment for a DocumentVersion's stored file. A function
 * (not inline) so the Blob migration has one obvious seam. The bytes are
 * copied into a fresh Uint8Array — Prisma 7's `Bytes` field type does not
 * accept a `Buffer<ArrayBufferLike>` directly.
 */
export function toVersionStorageFields(buffer: Buffer, meta: StoredFileMeta) {
  return {
    bytes: new Uint8Array(buffer),
    fileName: meta.fileName,
    contentType: meta.contentType,
    byteSize: meta.byteSize,
  };
}

export interface ReadFileResult {
  bytes: Buffer;
  contentType: string;
  fileName: string;
}

export async function readVersionFile(versionId: string): Promise<ReadFileResult | null> {
  const v = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { bytes: true, contentType: true, fileName: true },
  });
  if (!v || !v.bytes) return null;
  return { bytes: Buffer.from(v.bytes), contentType: v.contentType, fileName: v.fileName };
}
