import { describe, expect, it } from "vitest";

import {
  createPairingSchema,
  feedbackUpsertSchema,
  loginSchema,
  meetingLinkSchema,
  toCanonicalEmail,
  updateMeetingLinkSchema,
  weekSchema,
} from "./domain";

describe("domain schemas", () => {
  it("accepts valid week numbers", () => {
    expect(weekSchema.parse(1)).toBe(1);
    expect(weekSchema.parse(20)).toBe(20);
  });

  it("rejects invalid week numbers", () => {
    expect(() => weekSchema.parse(0)).toThrow();
    expect(() => weekSchema.parse(21)).toThrow();
  });

  it("validates login credentials", () => {
    const result = loginSchema.parse({
      identifier: "Teacher.User@example.com",
      password: "secret123",
      role: "teacher",
    });

    expect(result.identifier).toBe("Teacher.User@example.com");
    expect(result.role).toBe("teacher");
  });

  it("defaults feedback visibility and rating", () => {
    const result = feedbackUpsertSchema.parse({
      week: 3,
      text: "Great class",
    });

    expect(result.rating).toBeNull();
    expect(result.visibility).toBe("private");
  });

  it("derives a local email when one is missing", () => {
    expect(toCanonicalEmail(undefined, "alice", "teacher")).toBe(
      "alice.teacher@theuniquehope.local",
    );
  });

  it("requires deliverable emails when creating a pairing", () => {
    expect(() =>
      createPairingSchema.parse({
        student: {
          name: "Student",
          username: "student.one",
          email: "",
          password: "student123",
        },
        teacher: {
          name: "Teacher",
          username: "teacher.one",
          email: "teacher@theuniquehope.local",
          password: "teacher123",
        },
      }),
    ).toThrow();
  });

  it("accepts absolute https meeting links", () => {
    expect(meetingLinkSchema.parse("https://meeting.tencent.com/dm/demo-room")).toBe(
      "https://meeting.tencent.com/dm/demo-room",
    );
  });

  it("allows blank meeting links to clear to null", () => {
    expect(updateMeetingLinkSchema.parse({ meetingLink: "   " }).meetingLink).toBeNull();
  });

  it("rejects relative or non-http meeting links", () => {
    expect(() => meetingLinkSchema.parse("/teacher")).toThrow();
    expect(() => meetingLinkSchema.parse("ftp://meeting.tencent.com/room")).toThrow();
  });

  it("rejects meeting links longer than 500 characters", () => {
    const tooLong = `https://example.com/${"a".repeat(490)}`;
    expect(() => meetingLinkSchema.parse(tooLong)).toThrow();
  });
});
