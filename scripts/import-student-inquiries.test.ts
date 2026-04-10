import { afterEach, describe, expect, it } from "vitest";

import {
  hashSourceIp,
  inquiryInputSchema,
  normalizeRecord,
} from "./import-student-inquiries";

const originalIpHashKey = process.env.STUDENT_INQUIRIES_IP_HASH_KEY;

afterEach(() => {
  if (originalIpHashKey === undefined) {
    delete process.env.STUDENT_INQUIRIES_IP_HASH_KEY;
    return;
  }

  process.env.STUDENT_INQUIRIES_IP_HASH_KEY = originalIpHashKey;
});

describe("import-student-inquiries", () => {
  it("preserves exact source serials and hashes raw IPs with a keyed digest", () => {
    process.env.STUDENT_INQUIRIES_IP_HASH_KEY = "test-import-key";

    const record = normalizeRecord({
      sourceChannel: "wechat-form",
      sourceSerial: "0001",
      sourceSubmittedAt: "2026-04-09T10:00:00+08:00",
      sourceIp: "203.0.113.10",
      studentName: "Demo Student",
      gender: "女",
      school: "Demo High School",
      grade: "G10",
      englishScore: "TOEFL 102",
    });

    expect(record.sourceSerial).toBe("0001");
    expect(record.sourceIpHash).toBe(
      hashSourceIp("203.0.113.10", "test-import-key"),
    );
  });

  it("rejects source serials that are provided as JSON numbers", () => {
    const parsed = inquiryInputSchema.safeParse({
      sourceChannel: "wechat-form",
      sourceSerial: 1,
      sourceSubmittedAt: "2026-04-09T10:00:00+08:00",
      sourceIpHash:
        "hmac-sha256:825cde93b9c8f7ec247bb1f98a826f31d8a7ecb6bfdf38a29410eae878d4f8d4",
      studentName: "Demo Student",
      gender: "女",
      school: "Demo High School",
      grade: "G10",
      englishScore: "TOEFL 102",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects legacy plain SHA-256 sourceIpHash values", () => {
    const parsed = inquiryInputSchema.safeParse({
      sourceChannel: "wechat-form",
      sourceSerial: "0001",
      sourceSubmittedAt: "2026-04-09T10:00:00+08:00",
      sourceIpHash:
        "825cde93b9c8f7ec247bb1f98a826f31d8a7ecb6bfdf38a29410eae878d4f8d4",
      studentName: "Demo Student",
      gender: "女",
      school: "Demo High School",
      grade: "G10",
      englishScore: "TOEFL 102",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects mismatched sourceIp and sourceIpHash values", () => {
    process.env.STUDENT_INQUIRIES_IP_HASH_KEY = "test-import-key";

    expect(() =>
      normalizeRecord({
        sourceChannel: "wechat-form",
        sourceSerial: "0001",
        sourceSubmittedAt: "2026-04-09T10:00:00+08:00",
        sourceIp: "203.0.113.10",
        sourceIpHash:
          "hmac-sha256:825cde93b9c8f7ec247bb1f98a826f31d8a7ecb6bfdf38a29410eae878d4f8d4",
        studentName: "Demo Student",
        gender: "女",
        school: "Demo High School",
        grade: "G10",
        englishScore: "TOEFL 102",
      }),
    ).toThrow(/sourceIpHash does not match sourceIp/);
  });
});
