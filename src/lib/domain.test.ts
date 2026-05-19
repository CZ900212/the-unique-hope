import { describe, expect, it } from "vitest";

import {
  appointmentRequestSchema,
  appointmentResponseSchema,
  createPairingSchema,
  feedbackUpsertSchema,
  loginSchema,
  meetingLinkSchema,
  normalizeIdentifier,
  studentSignupSchema,
  toCanonicalEmail,
  teacherSignupSchema,
  reviewedSignupsFilterSchema,
  updateMeetingLinkSchema,
  usernameSchema,
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

  it("validates lesson appointment requests", () => {
    const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = appointmentRequestSchema.parse({
      scheduledStart: scheduledStart.toISOString(),
    });

    expect(result.scheduledStart).toEqual(scheduledStart);
    expect(result.durationMinutes).toBe(45);
  });

  it("rejects lesson appointment requests in the past", () => {
    expect(() =>
      appointmentRequestSchema.parse({
        scheduledStart: new Date(Date.now() - 60 * 1000).toISOString(),
      }),
    ).toThrow("Appointment time must be in the future.");
  });

  it("allows only structured appointment responses", () => {
    expect(
      appointmentResponseSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        action: "request_cancel",
        reason: "Schedule changed",
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      action: "request_cancel",
      reason: "Schedule changed",
    });
    expect(() =>
      appointmentResponseSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        action: "message",
      }),
    ).toThrow();
  });

  it("derives a local email when one is missing", () => {
    expect(toCanonicalEmail(undefined, "alice", "teacher")).toBe(
      "alice.teacher@theuniquehope.local",
    );
  });

  it("derives an ascii-safe managed email for multilingual usernames", () => {
    const email = toCanonicalEmail(undefined, "测试中文注册", "student");

    expect(email).toMatch(/^managed-student-[a-z0-9]+@theuniquehope\.local$/);
    expect(email).toBe(toCanonicalEmail(undefined, "测试中文注册", "student"));
  });

  it("normalizes optional signup emails when provided", () => {
    expect(
      studentSignupSchema.parse({
        age: 10,
        childName: "Student",
        contact: "",
        email: " Student@Example.com ",
        password: "student123",
        phone: "5551234567",
        username: "student-one",
      }).email,
    ).toBe("student@example.com");
  });

  it("allows signup emails to stay blank", () => {
    expect(
      teacherSignupSchema.parse({
        email: "",
        englishScore: "TOEFL 110",
        gender: "Female",
        grade: "College",
        name: "Teacher",
        password: "teacher123",
        school: "Example School",
        username: "teacher-one",
      }).email,
    ).toBeUndefined();
  });

  it("accepts multilingual usernames and normalizes latin letters", () => {
    expect(usernameSchema.parse("  测试User-123  ")).toBe("测试user-123");
  });

  it("rejects usernames with spaces or emoji", () => {
    expect(() => usernameSchema.parse("bad user")).toThrow();
    expect(() => usernameSchema.parse("测试😀账号")).toThrow();
  });

  it("normalizes usernames and emails with the right strategy", () => {
    expect(normalizeIdentifier("  测试User-123  ")).toBe("测试user-123");
    expect(normalizeIdentifier("  Teacher.User@Example.com ")).toBe(
      "teacher.user@example.com",
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
    expect(
      meetingLinkSchema.parse("https://meeting.tencent.com/dm/demo-room"),
    ).toBe("https://meeting.tencent.com/dm/demo-room");
  });

  it("accepts plain meeting details", () => {
    expect(
      meetingLinkSchema.parse(
        "Tencent Meeting ID: 123-456-789\nPasscode: hope2026",
      ),
    ).toBe("Tencent Meeting ID: 123-456-789\nPasscode: hope2026");
  });

  it("allows blank meeting links to clear to null", () => {
    expect(
      updateMeetingLinkSchema.parse({ meetingLink: "   " }).meetingLink,
    ).toBeNull();
  });

  it("rejects meeting links longer than 500 characters", () => {
    const tooLong = "a".repeat(501);
    expect(() => meetingLinkSchema.parse(tooLong)).toThrow();
  });

  it("defaults reviewed signup filters to all roles and statuses", () => {
    expect(reviewedSignupsFilterSchema.parse({})).toEqual({
      role: "all",
      status: "all",
    });
  });
});
