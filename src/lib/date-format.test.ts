import { describe, expect, it } from "vitest";

import { formatAppDateTime, formatAppTime } from "./date-format";

describe("app date formatting", () => {
  const date = new Date("2026-05-13T18:30:00Z");

  it("formats English times with a 24-hour clock", () => {
    const text = formatAppTime("en", date, { timeZone: "UTC" });

    expect(text).toBe("18:30");
    expect(text).not.toMatch(/\b(?:AM|PM)\b/i);
  });

  it("formats Chinese date-times with a 24-hour clock", () => {
    const text = formatAppDateTime("zh", date, "medium", {
      timeZone: "UTC",
    });

    expect(text).toContain("18:30");
    expect(text).not.toMatch(/上午|下午/);
  });

  it("honors the selected time zone without switching back to AM or PM", () => {
    const text = formatAppDateTime("en", date, "medium", {
      timeZone: "Asia/Shanghai",
    });

    expect(text).toContain("02:30");
    expect(text).not.toMatch(/\b(?:AM|PM)\b/i);
  });
});
