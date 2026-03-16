import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function signInAs(page: Page, input: {
  dashboardPath: "/admin" | "/teacher" | "/student";
  identifier: string;
  password: string;
  loginPath?: string;
  role: "Admin" | "Mentor" | "Learner";
}) {
  await page.goto(input.loginPath ?? "/login");
  if (input.role !== "Admin") {
    await page.getByRole("button", { name: input.role }).click();
  }
  await page.getByLabel("Email or Username").fill(input.identifier);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Step Inside" }).click();
  await expect(page).toHaveURL(new RegExp(`${input.dashboardPath}$`));
}

test("admin can sign in and see the seeded pairing list", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await expect(page.getByRole("heading", { name: "Community Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Connection" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByText("Demo Teacher")).toBeVisible();
});

test("admin can create a pairing from the modal at laptop height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  const unique = Date.now().toString().slice(-6);
  await page.getByRole("button", { name: "New Connection" }).click();
  const dialog = page.getByRole("dialog", { name: "Guide a new connection" });
  await dialog.locator('input[name="studentName"]').fill(`Viewport Student ${unique}`);
  await dialog.locator('input[name="studentContact"]').fill("student contact");
  await dialog.locator('input[name="studentUsername"]').fill(`viewport_student_${unique}`);
  await dialog.locator('input[name="studentEmail"]').fill(`viewport.student.${unique}@example.com`);
  await dialog.locator('input[name="studentPassword"]').fill("Viewport123456!");
  await dialog.locator('input[name="teacherName"]').fill(`Viewport Teacher ${unique}`);
  await dialog.locator('input[name="teacherContact"]').fill("teacher contact");
  await dialog.locator('input[name="teacherUsername"]').fill(`viewport_teacher_${unique}`);
  await dialog.locator('input[name="teacherEmail"]').fill(`viewport.teacher.${unique}@example.com`);
  await dialog.locator('input[name="teacherPassword"]').fill("Viewport123456!");
  await dialog.getByRole("button", { name: "Create connection" }).click();

  await expect(page.getByText(`Viewport Student ${unique}`)).toBeVisible();
  await expect(page.getByText(`Viewport Teacher ${unique}`)).toBeVisible();
});

test("teacher can sign in and see the seeded student dashboard data", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Mentor",
  });

  await expect(page.getByRole("heading", { name: "Week 01" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep this safe" })).toBeVisible();

  await page.getByRole("button", { name: "Meeting Link" }).click();
  const meetingDialog = page.getByRole("dialog", { name: "Your Space" });
  const meetingLinkInput = meetingDialog.getByRole("textbox", { name: "Where you'll meet" });
  await meetingLinkInput.fill("https://meeting.tencent.com/demo-room");
  await expect(meetingLinkInput).toHaveValue("https://meeting.tencent.com/demo-room");
  await meetingDialog.getByRole("button", { name: "Save", exact: true }).click();
});

test("teacher sees a safe upload error when storage rejects an evidence upload", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Mentor",
  });

  await page.getByRole("button", { name: "Week 2 · Waiting" }).click();
  await page.getByRole("button", { name: "Spent time together" }).click();
  await page.locator("#teacher-file-input").setInputFiles("public/images/Rose.png");
  await page.getByRole("button", { name: "Keep this safe" }).click();

  await expect(page.getByText("Unable to upload lesson evidence right now.")).toBeVisible();
});

test("student can sign in and reach the learning path dashboard", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Learner",
  });

  await expect(page.getByRole("heading", { name: "Your story so far" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This Week's Activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep these thoughts" })).toBeVisible();
});
