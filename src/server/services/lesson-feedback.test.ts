import { describe, expect, it } from "vitest";

import {
  findLatestTeacherVisibleFeedback,
  isStudentFeedbackAllowed,
} from "./lesson-feedback";

describe("lesson feedback policy", () => {
  it("allows student feedback only after a taught lesson", () => {
    expect(isStudentFeedbackAllowed("taught")).toBe(true);
    expect(isStudentFeedbackAllowed("pending")).toBe(false);
    expect(isStudentFeedbackAllowed("student_leave")).toBe(false);
    expect(isStudentFeedbackAllowed(undefined)).toBe(false);
  });

  it("surfaces only shared feedback from taught weeks to teachers", () => {
    const latest = findLatestTeacherVisibleFeedback(
      [
        {
          weekNumber: 4,
          text: "Future week feedback",
          rating: 5,
          visibility: "shared",
          updatedAt: new Date("2026-03-14T00:00:00Z"),
        },
        {
          weekNumber: 3,
          text: "Real lesson feedback",
          rating: 4,
          visibility: "shared",
          updatedAt: new Date("2026-03-13T00:00:00Z"),
        },
      ],
      [
        { weekNumber: 3, status: "taught" },
        { weekNumber: 4, status: "pending" },
      ],
    );

    expect(latest?.weekNumber).toBe(3);
    expect(latest?.text).toBe("Real lesson feedback");
  });
});
