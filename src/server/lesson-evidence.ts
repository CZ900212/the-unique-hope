import { del, list, put } from "@vercel/blob";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SECURE_EVIDENCE_ROUTE = "/api/uploads/lesson-evidence";
const LOCAL_EVIDENCE_PREFIX = "local:";

type LessonEvidenceStorageMode = "blob" | "local";

export type ResolvedLessonEvidence =
  | {
      kind: "blob";
      url: string;
    }
  | {
      contentLength: number;
      kind: "local";
      mime: string | null;
      buffer: Buffer;
    };

export function getBlobReadWriteToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ??
    null
  );
}

export function getLessonEvidenceStorageMode(): LessonEvidenceStorageMode | null {
  const preferredStorage = process.env.LESSON_EVIDENCE_STORAGE;
  if (preferredStorage === "local") {
    return "local";
  }

  if (preferredStorage === "blob") {
    return getBlobReadWriteToken() ? "blob" : null;
  }

  return getBlobReadWriteToken() ? "blob" : null;
}

export function isLocalLessonEvidenceKey(evidenceKey: string) {
  return evidenceKey.startsWith(LOCAL_EVIDENCE_PREFIX);
}

export function buildProtectedLessonEvidenceUrl(
  lessonId: string,
  evidenceKey: string | null | undefined,
) {
  if (!evidenceKey) {
    return null;
  }

  if (
    !isLocalLessonEvidenceKey(evidenceKey) &&
    !getLessonEvidenceStorageMode()
  ) {
    return null;
  }

  return `${SECURE_EVIDENCE_ROUTE}/${lessonId}`;
}

export function createStoredLessonEvidenceFields(
  uploaded: { pathname: string; url: string | null },
  evidenceMime: string,
) {
  return {
    evidenceKey: uploaded.pathname,
    evidenceUrl: null as string | null,
    evidenceMime,
  };
}

export async function storeLessonEvidenceFile(
  pathname: string,
  fileBuffer: Buffer,
  contentType: string,
) {
  const storageMode = getLessonEvidenceStorageMode();
  if (storageMode === "blob") {
    const uploaded = await put(pathname, fileBuffer, {
      access: "private",
      addRandomSuffix: false,
      contentType,
      token: getBlobReadWriteToken()!,
    });

    return {
      pathname: uploaded.pathname,
      url: uploaded.url,
    };
  }

  if (storageMode === "local") {
    const localKey = `${LOCAL_EVIDENCE_PREFIX}${pathname}`;
    const absolutePath = resolveLocalLessonEvidencePath(localKey);
    await mkdir(/* turbopackIgnore: true */ path.dirname(absolutePath), {
      recursive: true,
    });
    await writeFile(/* turbopackIgnore: true */ absolutePath, fileBuffer);

    return {
      pathname: localKey,
      url: null,
    };
  }

  return null;
}

export async function deleteStoredLessonEvidence(evidenceKey: string) {
  if (isLocalLessonEvidenceKey(evidenceKey)) {
    try {
      await rm(
        /* turbopackIgnore: true */ resolveLocalLessonEvidencePath(evidenceKey),
        {
          force: true,
        },
      );
    } catch {
      return;
    }
    return;
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return;
  }

  await del(evidenceKey, {
    token,
  }).catch(() => null);
}

export async function resolveStoredLessonEvidence(
  evidenceKey: string,
  evidenceMime: string | null | undefined,
): Promise<ResolvedLessonEvidence | null> {
  if (isLocalLessonEvidenceKey(evidenceKey)) {
    try {
      const absolutePath = resolveLocalLessonEvidencePath(evidenceKey);
      const [buffer, fileStats] = await Promise.all([
        readFile(/* turbopackIgnore: true */ absolutePath),
        stat(/* turbopackIgnore: true */ absolutePath),
      ]);

      return {
        buffer,
        contentLength: fileStats.size,
        kind: "local",
        mime: evidenceMime ?? null,
      };
    } catch {
      return null;
    }
  }

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

  if (!blob?.downloadUrl && !blob?.url) {
    return null;
  }

  return {
    kind: "blob",
    url: blob.downloadUrl ?? blob.url,
  };
}

function resolveLocalLessonEvidencePath(evidenceKey: string) {
  const relativePath = isLocalLessonEvidenceKey(evidenceKey)
    ? evidenceKey.slice(LOCAL_EVIDENCE_PREFIX.length)
    : evidenceKey;
  const storageRoot = path.resolve(
    /*turbopackIgnore: true*/ getLocalLessonEvidenceDir(),
  );
  const absolutePath = path.resolve(
    storageRoot,
    /*turbopackIgnore: true*/ relativePath,
  );
  const pathWithinRoot =
    absolutePath === storageRoot ||
    absolutePath.startsWith(`${storageRoot}${path.sep}`);

  if (!pathWithinRoot) {
    throw new Error("Invalid local lesson evidence path.");
  }

  return absolutePath;
}

function getLocalLessonEvidenceDir() {
  const configuredDirectory = process.env.LESSON_EVIDENCE_LOCAL_DIR?.trim();
  if (configuredDirectory) {
    return configuredDirectory;
  }

  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "storage",
    "lesson-evidence",
  );
}
