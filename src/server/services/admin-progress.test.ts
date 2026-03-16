import { describe, expect, it } from "vitest";

import {
  buildAdminProgressReport,
  serializeAdminPairingProgress,
} from "./admin-progress";

describe("admin progress helpers", () => {
  it("computes taught counts from lesson statuses", () => {
    const row = serializeAdminPairingProgress({
      id: "pairing-1",
      createdAt: new Date("2026-03-11T00:00:00Z"),
      teacher: null,
      student: null,
      lessons: [
        { weekNumber: 1, status: "taught" },
        { weekNumber: 2, status: "pending" },
        { weekNumber: 3, status: "taught" },
      ],
    });

    expect(row.progress.taughtCount).toBe(2);
    expect(row.progress.lessons).toHaveLength(3);
  });

  it("keeps all rows in the full progress report", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `pairing-${index + 1}`,
      createdAt: new Date("2026-03-11T00:00:00Z"),
      teacher: null,
      student: null,
      lessons: [{ weekNumber: 1, status: "pending" }],
    }));

    const report = buildAdminProgressReport(rows);

    expect(report.totalPairings).toBe(101);
    expect(report.pairings).toHaveLength(101);
  });
});
