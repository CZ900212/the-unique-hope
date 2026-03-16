import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getBlobReadWriteToken: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    execute: mocks.execute,
  },
}));

vi.mock("~/server/lesson-evidence", () => ({
  getBlobReadWriteToken: mocks.getBlobReadWriteToken,
}));

const { GET } = await import("./route");

describe("health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getBlobReadWriteToken.mockReturnValue("blob-token");
  });

  it("returns 200 when the database probe succeeds", async () => {
    mocks.execute.mockResolvedValue([{ "?column?": 1 }]);

    const response = await GET();
    const payload = (await response.json()) as {
      checks: { blob: string; database: string };
      ok: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.checks).toEqual({
      blob: "configured",
      database: "ok",
    });
  });

  it("returns 503 when the database probe fails", async () => {
    mocks.execute.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();
    const payload = (await response.json()) as {
      checks: { blob: string; database: string };
      ok: boolean;
    };

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.checks).toEqual({
      blob: "configured",
      database: "error",
    });
  });
});
