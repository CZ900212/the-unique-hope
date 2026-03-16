import { describe, expect, it } from "vitest";

import { getDefaultStudentWeek, getDefaultTeacherWeek } from "./dashboard-state";

describe("dashboard state helpers", () => {
  it("opens the teacher dashboard on the next week after the latest completed lesson", () => {
    expect(
      getDefaultTeacherWeek([
        { status: "taught", week_number: 1 },
        { status: "taught", week_number: 2 },
      ]),
    ).toBe(3);
  });

  it("keeps the teacher on the latest recorded week when it is still pending", () => {
    expect(getDefaultTeacherWeek([{ status: "pending", week_number: 4 }])).toBe(4);
  });

  it("opens the student dashboard on the latest taught week", () => {
    expect(
      getDefaultStudentWeek([
        { hasEvidence: false, status: "pending", weekNumber: 1 },
        { hasEvidence: true, status: "taught", weekNumber: 4 },
      ]),
    ).toBe(4);
  });

  it("falls back to the latest week with evidence when nothing is taught yet", () => {
    expect(
      getDefaultStudentWeek([
        { hasEvidence: false, status: "pending", weekNumber: 1 },
        { hasEvidence: true, status: "pending", weekNumber: 3 },
      ]),
    ).toBe(3);
  });
});
