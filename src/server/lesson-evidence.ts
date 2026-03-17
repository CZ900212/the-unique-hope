import { list, type PutBlobResult } from "@vercel/blob";

const SECURE_EVIDENCE_ROUTE = "/api/uploads/lesson-evidence";

export function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN ?? null;
}

export function buildProtectedLessonEvidenceUrl(
  lessonId: string,
  evidenceKey: string | null | undefined,
) {
  if (!evidenceKey || !getBlobReadWriteToken()) {
    return null;
  }

  return `${SECURE_EVIDENCE_ROUTE}/${lessonId}`;
}

export function createStoredLessonEvidenceFields(
  uploaded: Pick<PutBlobResult, "pathname" | "url">,
  evidenceMime: string,
) {
  return {
    evidenceKey: uploaded.pathname,
    evidenceUrl: null as string | null,
    evidenceMime,
  };
}

export async function resolveStoredLessonEvidenceUrl(evidenceKey: string) {
  const token = getBlobReadWriteToken();
  if (!token) {
    return null;
  }

  const { blobs } = await list({
    prefix: evidenceKey,
    limit: 10,
    token,
  });
  const blob = blobs.find((candidate) => candidate.pathname === evidenceKey);

  return blob?.downloadUrl ?? blob?.url ?? null;
}
