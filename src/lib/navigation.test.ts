import { describe, expect, it } from "vitest";

import { resolveSafeCallbackPath } from "./navigation";

describe("resolveSafeCallbackPath", () => {
  const fallbackPath = "/teacher";
  const origin = "https://theuniquehope.org";

  it("keeps internal relative paths", () => {
    expect(resolveSafeCallbackPath("/student?tab=progress", fallbackPath, origin)).toBe(
      "/student?tab=progress",
    );
  });

  it("normalizes same-origin absolute URLs to relative paths", () => {
    expect(
      resolveSafeCallbackPath(
        "https://theuniquehope.org/admin?view=progress#export",
        fallbackPath,
        origin,
      ),
    ).toBe("/admin?view=progress#export");
  });

  it("falls back for external origins", () => {
    expect(
      resolveSafeCallbackPath("https://evil.example/phish", fallbackPath, origin),
    ).toBe(fallbackPath);
  });

  it("falls back for protocol-relative and malformed values", () => {
    expect(resolveSafeCallbackPath("//evil.example/phish", fallbackPath, origin)).toBe(
      fallbackPath,
    );
    expect(resolveSafeCallbackPath("http://[", fallbackPath, origin)).toBe(fallbackPath);
  });

  it("falls back for empty strings and javascript payloads", () => {
    expect(resolveSafeCallbackPath("", fallbackPath, origin)).toBe(fallbackPath);
    expect(resolveSafeCallbackPath("javascript:alert(1)", fallbackPath, origin)).toBe(
      fallbackPath,
    );
  });
});
