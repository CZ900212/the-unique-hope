import { expect, test } from "@playwright/test";

test("homepage shows the new T3-style workflow positioning", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "One-on-one online English support for children with rare diseases.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Register A Student" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Teacher / Student Login" })).toBeVisible();
});

test("public auth routes render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Continue your story." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guide" })).toHaveCount(0);

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Start with a calm, reviewed intake." })).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Recover access without changing the login flow." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guide" })).toHaveCount(0);

  await page.goto("/reset-password?token=test-reset-token-value");
  await expect(page.getByRole("heading", { name: "Finish with a fresh password." })).toBeVisible();

  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Enter the review workspace." })).toBeVisible();
});

test("admin routes redirect to the dedicated admin login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Enter the review workspace." })).toBeVisible();

  const internalResponse = await page.goto("/_internal/admin-login", {
    waitUntil: "domcontentloaded",
  });
  expect(internalResponse?.status()).toBe(404);
});

test("teacher and student dashboards redirect to login when signed out", async ({ page }) => {
  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/student");
  await expect(page).toHaveURL(/\/login$/);
});
