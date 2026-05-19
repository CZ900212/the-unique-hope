import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";

const mocks = vi.hoisted(() => ({
  enforcePublicSignupRateLimit: vi.fn(),
  enforceTeacherSignupRateLimit: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  hash: mocks.hash,
}));

vi.mock("~/server/services/public-signups", () => ({
  enforcePublicSignupRateLimit: mocks.enforcePublicSignupRateLimit,
  enforceTeacherSignupRateLimit: mocks.enforceTeacherSignupRateLimit,
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/auth/active-session", () => ({
  loadActiveUserSession: vi.fn(),
}));

const { publicRouter } = await import("./public");
const { createCallerFactory } = await import("~/server/api/trpc");

const createCaller = createCallerFactory(publicRouter);

function createDb(input?: { duplicateTeacherSignup?: boolean }) {
  const insertedValues: unknown[] = [];

  return {
    insertedValues,
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      if (input?.duplicateTeacherSignup) {
        throw Object.assign(
          new Error("duplicate key value violates unique constraint"),
          { code: "23505" },
        );
      }

      let insertCall = 0;
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn((values: unknown) => {
            insertedValues.push(values);
            insertCall += 1;

            if (insertCall === 1) {
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "user-1",
                  },
                ]),
              };
            }

            if (insertCall === 2) {
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "profile-1",
                    matchStatus: "pending",
                    username: "teacher_example",
                  },
                ]),
              };
            }

            if (insertCall === 3) {
              return Promise.resolve(undefined);
            }

            return {
              returning: vi.fn().mockResolvedValue([
                {
                  createdAt: new Date("2026-04-18T00:00:00Z"),
                  id: "teacher-signup-1",
                },
              ]),
            };
          }),
        })),
      };

      return callback(tx);
    }),
  };
}

describe("public teacher signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hash.mockResolvedValue("hashed-password");
    mocks.enforcePublicSignupRateLimit.mockResolvedValue(undefined);
    mocks.enforceTeacherSignupRateLimit.mockResolvedValue(undefined);
  });

  it("creates a teacher signup after passing the rate limit gate", async () => {
    const db = createDb();
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.50",
    });
    const caller = createCaller({
      db: db as never,
      headers,
      locale: "en",
      session: null,
    });

    const result = await caller.createTeacherSignup({
      englishScore: "IELTS 7.5",
      gender: "Female",
      grade: "College",
      name: "Teacher Example",
      password: "Public123456",
      email: "Teacher@Example.com",
      school: "Example School",
      username: "Teacher_Example",
    });

    expect(result.signup).toMatchObject({
      id: "teacher-signup-1",
      matchingStatus: "pending",
      username: "teacher_example",
    });
    expect(mocks.enforceTeacherSignupRateLimit).toHaveBeenCalledWith(
      headers,
      "teacher_example",
      "en",
    );
    expect(db.insertedValues[0]).toMatchObject({
      email: "teacher@example.com",
    });
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("rejects teacher signup requests when the throttling gate is exhausted", async () => {
    mocks.enforceTeacherSignupRateLimit.mockRejectedValue(
      new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many signup submissions. Try again later.",
      }),
    );

    const db = createDb();
    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    await expect(
      caller.createTeacherSignup({
        englishScore: "IELTS 7.5",
        gender: "Female",
        grade: "College",
        name: "Teacher Example",
        password: "Public123456",
        school: "Example School",
        username: "Teacher_Example",
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many signup submissions. Try again later.",
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns a conflict when the teacher signup is submitted twice", async () => {
    const caller = createCaller({
      db: createDb({ duplicateTeacherSignup: true }) as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    await expect(
      caller.createTeacherSignup({
        englishScore: "IELTS 7.5",
        gender: "Female",
        grade: "College",
        name: "Teacher Example",
        password: "Public123456",
        school: "Example School",
        username: "Teacher_Example",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That username is already in use.",
    });
  });
});
