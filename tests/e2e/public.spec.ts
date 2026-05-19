import { expect, test } from "@playwright/test";

test("homepage shows the new T3-style workflow positioning", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "One-on-one online English support for children with rare diseases.",
    }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Apply to Join" }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Sign In" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Chinese" }),
  ).toBeVisible();
});

test("public auth routes render", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByLabel("Email or Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Profile Details" }),
  ).toBeVisible();
  await expect(page.getByLabel("Child's Name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

  await page.goto("/signup?role=teacher");
  await page.getByRole("button", { name: "Tutor" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Your Tutor Account" }),
  ).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect(
    page.getByLabel("Standardized Scores (SAT/TOEFL, etc.)"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Recover your account." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Admin" })).toHaveCount(0);
  await expect(page.getByLabel("Phone Number")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send Code" })).toBeVisible();

  await page.goto("/reset-password?token=test-reset-token-value");
  await expect(
    page.getByRole("heading", { name: "Set a new password." }),
  ).toBeVisible();
  await expect(page.getByLabel("New Password")).toBeVisible();
  await expect(page.getByLabel("Confirm Password")).toBeVisible();

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Admin workspace." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email or Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("reset password route without a token blocks submission and guides the user back", async ({
  page,
}) => {
  await page.goto("/reset-password");

  await expect(
    page.getByText(
      "Reset token is missing. Request a new password reset link.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("New Password")).toBeDisabled();
  await expect(page.getByLabel("Confirm Password")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Update Password" }),
  ).toBeDisabled();

  await page.getByRole("link", { name: "Request another link" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Recover your account." }),
  ).toBeVisible();
});

test("student registration creates an account that can sign in and wait", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);
  const username = `学生${unique}`;

  await page.goto("/signup");
  await page.getByLabel("Child's Name").fill(`Playwright Child ${unique}`);
  await page.getByLabel("Age").fill("10");
  await page.getByLabel("Phone Number").fill(`555000${unique}`);
  await page.getByLabel("Other Contact").fill("Playwright family contact");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Username").fill(username);
  await page.locator('input[name="password"]').fill("Public123456");
  await page.getByLabel("Confirm Password").fill("Public123456");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText("Account created. Sign in to check your match status."),
  ).toBeVisible();

  await page.goto("/login");
  await page.getByRole("button", { name: "Tutee" }).click();
  await page.getByLabel("Email or Username").fill(username);
  await page.getByLabel("Password").fill("Public123456");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(
    page.locator("h1", { hasText: "Waiting to be matched with a tutor" }),
  ).toBeVisible();
});

test("teacher registration creates an account that can sign in and wait", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);
  const username = `导师${unique}`;

  await page.goto("/signup?role=teacher");
  await page.getByRole("button", { name: "Tutor" }).click();
  await page.locator('input[name="name"]').fill(`Playwright Teacher ${unique}`);
  await page.getByLabel("Gender").fill("Female");
  await page.getByLabel("School").fill("Playwright Academy");
  await page.getByLabel("Grade").fill("College");
  await page
    .getByLabel("Standardized Scores (SAT/TOEFL, etc.)")
    .fill("IELTS 7.5");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Username").fill(username);
  await page.locator('input[name="password"]').fill("Public123456");
  await page.getByLabel("Confirm Password").fill("Public123456");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(
    page.getByText("Account created. Sign in to check your match status."),
  ).toBeVisible();

  await page.goto("/login");
  await page.getByRole("button", { name: "Tutor" }).click();
  await page.getByLabel("Email or Username").fill(username);
  await page.getByLabel("Password").fill("Public123456");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(
    page.locator("h1", { hasText: "Waiting to be matched with a tutee" }),
  ).toBeVisible();
});

test("signup rejects usernames with spaces or emoji before submit", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Child's Name").fill("Playwright Invalid Username");
  await page.getByLabel("Age").fill("10");
  await page.getByLabel("Phone Number").fill("5550009999");
  await page.getByLabel("Other Contact").fill("Playwright family contact");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Username").fill("bad user😀");
  await page.locator('input[name="password"]').fill("Public123456");
  await page.getByLabel("Confirm Password").fill("Public123456");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.locator("form [role='alert']")).toHaveText(
    "Use 3-32 letters or numbers from any language. You can also use . _ - but not spaces or emoji.",
  );
});

test("forgot password request submits a manual recovery request", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);

  await page.goto("/forgot-password");
  await page.getByLabel("Name").fill(`Recovery ${unique}`);
  await page.getByLabel("Contact").fill(`wechat-${unique}`);
  await page.getByRole("button", { name: "Send to Admin" }).click();

  await expect(
    page.getByText(
      "Your request has been sent to the admin team for confirmation.",
    ),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/phone=/);
});

test("admin routes redirect to the dedicated admin login when signed out", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole("heading", { name: "Admin workspace." }),
  ).toBeVisible();

  const internalResponse = await page.goto("/_internal/admin-login", {
    waitUntil: "domcontentloaded",
  });
  expect(internalResponse?.status()).toBe(404);
});

test("teacher and student dashboards redirect to login when signed out", async ({
  page,
}) => {
  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/student");
  await expect(page).toHaveURL(/\/login$/);
});

test("locale switcher updates content and persists across navigation and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to Chinese" }).click();

  await expect(
    page.getByRole("heading", { name: "为罕见病儿童提供一对一线上英语支持。" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "切换到英文" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "欢迎回来。" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "欢迎回来。" })).toBeVisible();
});
