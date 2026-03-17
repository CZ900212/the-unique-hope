import { describe, expect, it } from "vitest";

import {
  buildProtectedLessonEvidenceUrl,
  createStoredLessonEvidenceFields,
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
});

function restoreEnv(key: "BLOB_READ_WRITE_TOKEN" | "VERCEL_BLOB_READ_WRITE_TOKEN", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
