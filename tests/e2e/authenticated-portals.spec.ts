import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function signInAs(page: Page, input: {
  dashboardPath: "/admin" | "/teacher" | "/student";
  identifier: string;
  password: string;
  loginPath?: string;
  role: "Admin" | "Tutor" | "Tutee";
}) {
  await page.goto(input.loginPath ?? "/login");
  if (input.role !== "Admin") {
    await page.getByRole("button", { name: input.role }).click();
  }
  await page.getByLabel("Email or Username").fill(input.identifier);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign In" }).click();
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

  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New pairing" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByText("Demo Teacher")).toBeVisible();
});

test("admin can match a waiting student and teacher from the modal at laptop height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const unique = Date.now().toString().slice(-6);

  await page.goto("/signup");
  await page.getByLabel("Child's Name").fill(`Viewport Student ${unique}`);
  await page.getByLabel("Age").fill("10");
  await page.getByLabel("Phone Number").fill(`555100${unique}`);
  await page.getByLabel("Other Contact").fill("student contact");
  await page.getByLabel("Username").fill(`viewport_student_${unique}`);
  await page.getByLabel("Password").fill("Viewport123456!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await page.goto("/signup?role=teacher");
  await page.getByRole("button", { name: "Tutor" }).click();
  await page.locator('input[name="name"]').fill(`Viewport Teacher ${unique}`);
  await page.getByLabel("Gender").fill("Female");
  await page.getByLabel("School").fill("Viewport School");
  await page.getByLabel("Grade").fill("College");
  await page.getByLabel("Standardized Scores (SAT/TOEFL, etc.)").fill("TOEFL 110");
  await page.getByLabel("Username").fill(`viewport_teacher_${unique}`);
  await page.getByLabel("Password").fill("Viewport123456!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await page.getByRole("button", { name: "Waiting Pool" }).click();
  await expect(page.getByText(`Viewport Student ${unique}`)).toBeVisible();
  await expect(page.getByText(`Viewport Teacher ${unique}`)).toBeVisible();

  await page.getByRole("button", { name: "New pairing" }).click();
  const dialog = page.getByRole("dialog", { name: "New pairing" });
  await dialog.locator('select[name="studentProfileId"]').selectOption({ label: `Viewport Student ${unique} · viewport_student_${unique}` });
  await dialog.locator('select[name="teacherProfileId"]').selectOption({ label: `Viewport Teacher ${unique} · viewport_teacher_${unique}` });
  await dialog.getByRole("button", { name: "Create pairing" }).click();

  await page.getByRole("button", { name: "Pairings" }).click();
  await expect(page.getByText(`Viewport Student ${unique}`)).toBeVisible();
  await expect(page.getByText(`Viewport Teacher ${unique}`)).toBeVisible();
});

test("teacher can sign in and see the seeded student dashboard data", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await expect(page.getByRole("heading", { name: "Week 01" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save lesson" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();

  await page.getByRole("button", { name: "Meeting Link" }).click();
  const meetingDialog = page.getByRole("dialog", { name: "Meeting link" });
  const meetingLinkInput = meetingDialog.getByRole("textbox", { name: "Meeting link" });
  await meetingLinkInput.fill("https://meeting.tencent.com/demo-room");
  await expect(meetingLinkInput).toHaveValue("https://meeting.tencent.com/demo-room");
  await meetingDialog.getByRole("button", { name: "Save", exact: true }).click();
});

test("teacher dialogs close with Escape and logout returns to the homepage", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  const guidelinesTrigger = page.getByRole("button", { name: "Guidelines" });
  await guidelinesTrigger.click();
  await expect(page.getByRole("dialog", { name: "Tutor guidelines" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Tutor guidelines" })).toHaveCount(0);
  await expect(guidelinesTrigger).toBeFocused();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "One-on-one online English support for children with rare diseases.",
    }),
  ).toBeVisible();
});

test("teacher sees a safe upload error when storage rejects an evidence upload", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Week 2 · Pending" }).click();
  await page.getByRole("button", { name: "Taught" }).click();
  await page.locator("#teacher-file-input").setInputFiles("public/images/Rose.png");
  await page.getByRole("button", { name: "Save lesson" }).click();

  await expect(page.getByText("Couldn't upload the lesson photo. Please try again.")).toBeVisible();
});

test("student can sign in and reach the learning path dashboard", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Tutee",
  });

  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week's lesson" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit feedback" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByRole("heading", { name: "我的学习路径" })).toBeVisible();
});

test("admin can decline a waiting signup and the student sees the rejection state", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);
  const childName = `Rejected Student ${unique}`;
  const username = `rejected_student_${unique}`;
  const rejectReason = `Needs a manual review ${unique}`;

  await page.goto("/signup");
  await page.getByLabel("Child's Name").fill(childName);
  await page.getByLabel("Age").fill("9");
  await page.getByLabel("Phone Number").fill(`555200${unique}`);
  await page.getByLabel("Other Contact").fill("family contact");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("Rejected123456!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.getByText("Account created. Sign in to check your match status."),
  ).toBeVisible();

  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await page.getByRole("button", { name: "Waiting Pool" }).click();
  const signupRow = page.locator("tr", { hasText: childName }).first();
  await expect(signupRow).toBeVisible();
  await signupRow.getByRole("button", { name: "Decline" }).click();

  const rejectDialog = page.getByRole("dialog", {
    name: `Decline registration: ${childName}`,
  });
  await rejectDialog.getByLabel("Reason for declining").fill(rejectReason);
  await rejectDialog.getByRole("button", { name: "Confirm decline" }).click();

  await expect(page.locator("tr", { hasText: childName })).toHaveCount(0);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/student",
    identifier: username,
    password: "Rejected123456!",
    role: "Tutee",
  });

  await expect(page.getByRole("heading", { name: "Registration not accepted" })).toBeVisible();
  await expect(page.getByText(rejectReason)).toBeVisible();
});

test("teacher can save a taught lesson and the student can submit shared feedback", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);
  const teacherNote = `Teacher note ${unique}`;
  const studentFeedback = `Student feedback ${unique}`;

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Taught" }).click();
  await page.getByLabel("Lesson notes").fill(teacherNote);
  await page.getByLabel("Who can see this note").selectOption("shared");
  await page.getByRole("button", { name: "Save lesson" }).click();
  await expect(page.getByText("Lesson saved.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Tutee",
  });

  await expect(page.getByText(teacherNote)).toBeVisible();
  await page.getByLabel("Your feedback").fill(studentFeedback);
  await page.getByLabel("Who can see this").selectOption("shared");
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.getByText("Feedback saved.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await expect(page.getByText(studentFeedback)).toBeVisible();
});
