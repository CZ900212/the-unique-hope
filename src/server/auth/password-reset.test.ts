import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";

const { createPasswordResetEmailContent } = await import("./password-reset");

describe("createPasswordResetEmailContent", () => {
  it("escapes user-controlled fields in the HTML body", () => {
    const payload = createPasswordResetEmailContent({
      email: "teacher@example.com",
      name: `<img src=x onerror="alert('xss')"> & Guide`,
      resetUrl: "https://example.com/reset?token=a&next=%2Fteacher",
    });

    expect(payload.html).toContain(
      "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; Guide",
    );
    expect(payload.html).toContain(
      'href="https://example.com/reset?token=a&amp;next=%2Fteacher"',
    );
    expect(payload.html).not.toContain('<img src=x onerror="alert(\'xss\')">');
  });
});
