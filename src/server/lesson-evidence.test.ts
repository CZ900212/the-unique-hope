import { describe, expect, it } from "vitest";

import {
  buildProtectedLessonEvidenceUrl,
  createStoredLessonEvidenceFields,
} from "./lesson-evidence";

describe("lesson evidence helpers", () => {
  it("returns an internal authenticated route instead of a blob URL", () => {
    expect(
      buildProtectedLessonEvidenceUrl(
        "lesson-123",
        "lessons/pairing-1/week-1/file.png",
      ),
    ).toBe("/api/uploads/lesson-evidence/lesson-123");
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
