import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildProtectedLessonEvidenceUrl,
  createStoredLessonEvidenceFields,
  deleteStoredLessonEvidence,
  resolveStoredLessonEvidence,
  storeLessonEvidenceFile,
} from "./lesson-evidence";

describe("lesson evidence helpers", () => {
  it("returns null when blob storage is unavailable", () => {
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
    const previousLegacyToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

    try {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

      expect(
        buildProtectedLessonEvidenceUrl(
          "lesson-123",
          "lessons/pairing-1/week-1/file.png",
        ),
      ).toBeNull();
    } finally {
      restoreEnv("BLOB_READ_WRITE_TOKEN", previousToken);
      restoreEnv("VERCEL_BLOB_READ_WRITE_TOKEN", previousLegacyToken);
    }
  });

  it("returns an internal authenticated route instead of a blob URL", () => {
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;

    try {
      process.env.BLOB_READ_WRITE_TOKEN = "blob-token";

      expect(
        buildProtectedLessonEvidenceUrl(
          "lesson-123",
          "lessons/pairing-1/week-1/file.png",
        ),
      ).toBe("/api/uploads/lesson-evidence/lesson-123");
    } finally {
      restoreEnv("BLOB_READ_WRITE_TOKEN", previousToken);
    }
  });

  it("returns null when there is no stored evidence key", () => {
    expect(buildProtectedLessonEvidenceUrl("lesson-123", null)).toBeNull();
  });

  it("returns an internal authenticated route for local storage keys", () => {
    const previousStorage = process.env.LESSON_EVIDENCE_STORAGE;

    try {
      process.env.LESSON_EVIDENCE_STORAGE = "local";

      expect(
        buildProtectedLessonEvidenceUrl(
          "lesson-123",
          "local:lessons/pairing-1/week-1/file.png",
        ),
      ).toBe("/api/uploads/lesson-evidence/lesson-123");
    } finally {
      restoreOptionalEnv("LESSON_EVIDENCE_STORAGE", previousStorage);
    }
  });

  it("does not persist the public blob URL", () => {
    expect(
      createStoredLessonEvidenceFields(
        {
          pathname: "lessons/pairing-1/week-1/file.png",
          url: "https://store.public.blob.vercel-storage.com/lessons/pairing-1/week-1/file.png",
        },
        "image/png",
      ),
    ).toEqual({
      evidenceKey: "lessons/pairing-1/week-1/file.png",
      evidenceMime: "image/png",
      evidenceUrl: null,
    });
  });

  it("stores, resolves, and deletes local evidence files", async () => {
    const previousStorage = process.env.LESSON_EVIDENCE_STORAGE;
    const previousLocalDir = process.env.LESSON_EVIDENCE_LOCAL_DIR;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "lesson-evidence-"));

    try {
      process.env.LESSON_EVIDENCE_STORAGE = "local";
      process.env.LESSON_EVIDENCE_LOCAL_DIR = tempDir;

      const uploaded = await storeLessonEvidenceFile(
        "lessons/pairing-1/week-2/file.png",
        Buffer.from("local-file"),
        "image/png",
      );

      expect(uploaded).not.toBeNull();
      expect(uploaded).toEqual({
        pathname: "local:lessons/pairing-1/week-2/file.png",
        url: null,
      });

      const storedFile = await readFile(
        path.join(tempDir, "lessons/pairing-1/week-2/file.png"),
        "utf8",
      );
      expect(storedFile).toBe("local-file");

      const resolved = await resolveStoredLessonEvidence(
        uploaded!.pathname,
        "image/png",
      );
      expect(resolved).toMatchObject({
        kind: "local",
        mime: "image/png",
      });
      expect(
        resolved?.kind === "local" ? resolved.buffer.toString("utf8") : null,
      ).toBe("local-file");

      await deleteStoredLessonEvidence(uploaded!.pathname);

      expect(
        await resolveStoredLessonEvidence(uploaded!.pathname, "image/png"),
      ).toBeNull();
    } finally {
      restoreOptionalEnv("LESSON_EVIDENCE_STORAGE", previousStorage);
      restoreOptionalEnv("LESSON_EVIDENCE_LOCAL_DIR", previousLocalDir);
    }
  });

  it("does not resolve local evidence paths outside the storage directory", async () => {
    const previousStorage = process.env.LESSON_EVIDENCE_STORAGE;
    const previousLocalDir = process.env.LESSON_EVIDENCE_LOCAL_DIR;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "lesson-evidence-"));

    try {
      process.env.LESSON_EVIDENCE_STORAGE = "local";
      process.env.LESSON_EVIDENCE_LOCAL_DIR = tempDir;

      await expect(
        storeLessonEvidenceFile(
          "../outside.png",
          Buffer.from("bad"),
          "image/png",
        ),
      ).rejects.toThrow("Invalid local lesson evidence path.");
      await expect(
        storeLessonEvidenceFile(
          "/tmp/outside.png",
          Buffer.from("bad"),
          "image/png",
        ),
      ).rejects.toThrow("Invalid local lesson evidence path.");
      await expect(
        resolveStoredLessonEvidence("local:../outside.png", "image/png"),
      ).resolves.toBeNull();
      await expect(
        deleteStoredLessonEvidence("local:../outside.png"),
      ).resolves.toBeUndefined();
    } finally {
      restoreOptionalEnv("LESSON_EVIDENCE_STORAGE", previousStorage);
      restoreOptionalEnv("LESSON_EVIDENCE_LOCAL_DIR", previousLocalDir);
    }
  });
});

function restoreEnv(
  key: "BLOB_READ_WRITE_TOKEN" | "VERCEL_BLOB_READ_WRITE_TOKEN",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function restoreOptionalEnv(
  key: "LESSON_EVIDENCE_LOCAL_DIR" | "LESSON_EVIDENCE_STORAGE",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
