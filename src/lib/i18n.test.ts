import { describe, expect, it } from "vitest";

import { LOCALE_COOKIE_NAME, resolveRequestLocale } from "./i18n";

describe("resolveRequestLocale", () => {
  it("prefers the locale cookie over the configured fallback", () => {
    const headers = new Headers({
      cookie: `${LOCALE_COOKIE_NAME}=zh`,
    });

    expect(resolveRequestLocale(headers, "en")).toBe("zh");
  });

  it("falls back to the configured locale when the cookie value is invalid", () => {
    const headers = new Headers({
      cookie: `${LOCALE_COOKIE_NAME}=fr`,
    });

    expect(resolveRequestLocale(headers, "zh")).toBe("zh");
  });

  it("falls back to english when no cookie or valid fallback is present", () => {
    expect(resolveRequestLocale(new Headers(), "fr")).toBe("en");
  });
});
