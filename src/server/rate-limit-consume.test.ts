import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteWhere: vi.fn(),
  deleteTable: vi.fn(),
  insertReturning: vi.fn(),
  insertOnConflictDoUpdate: vi.fn(),
  insertValues: vi.fn(),
  insertTable: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
  gt: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock("~/server/db/schema", () => ({
  requestRateLimits: {
    action: "action",
    count: "count",
    expiresAt: "expiresAt",
    key: "key",
    subjectHash: "subjectHash",
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    delete: mocks.deleteTable,
    insert: mocks.insertTable,
  },
}));

const { consumeRateLimit } = await import("./rate-limit");

describe("consumeRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.deleteTable.mockReturnValue({
      where: mocks.deleteWhere,
    });
    mocks.insertReturning.mockResolvedValue([
      {
        count: 1,
      },
    ]);
    mocks.insertOnConflictDoUpdate.mockReturnValue({
      returning: mocks.insertReturning,
    });
    mocks.insertValues.mockReturnValue({
      onConflictDoUpdate: mocks.insertOnConflictDoUpdate,
    });
    mocks.insertTable.mockReturnValue({
      values: mocks.insertValues,
    });
  });

  it("prunes expired buckets before incrementing the current bucket", async () => {
    const result = await consumeRateLimit({
      action: "signup:phone",
      limit: 2,
      subject: "+15551234567",
      windowMs: 60 * 60 * 1000,
    });

    expect(mocks.deleteTable).toHaveBeenCalledTimes(1);
    expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
    expect(mocks.insertTable).toHaveBeenCalledTimes(1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(typeof result.retryAfterSeconds).toBe("number");
  });
});
