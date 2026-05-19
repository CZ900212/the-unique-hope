import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function signInAs(
  page: Page,
  input: {
    dashboardPath: "/admin" | "/teacher" | "/student";
    identifier: string;
    password: string;
    loginPath?: string;
    role: "Admin" | "Tutor" | "Tutee";
  },
) {
  await page.goto(input.loginPath ?? "/login");
  if (input.role !== "Admin") {
    await page.getByRole("button", { name: input.role }).click();
  }
  await page.getByLabel("Email or Username").fill(input.identifier);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(new RegExp(`${input.dashboardPath}$`));
}

function futureLessonDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 30, 0, 0);
  return date;
}

function toTimeInputValue(date: Date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

function formatBookingDateText(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

test("admin can sign in and see the seeded pairing list", async ({ page }) => {
  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New pairing" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByText("Demo Teacher")).toBeVisible();
});

test("admin must approve a waiting student and teacher before matching them from the modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const unique = Date.now().toString().slice(-6);
  const studentName = `Viewport Student ${unique}`;
  const teacherName = `Viewport Teacher ${unique}`;
  const studentUsername = `viewport_student_${unique}`;
  const teacherUsername = `viewport_teacher_${unique}`;

  await page.goto("/signup");
  await page.getByLabel("Child's Name").fill(studentName);
  await page.getByLabel("Age").fill("10");
  await page.getByLabel("Phone Number").fill(`555100${unique}`);
  await page.getByLabel("Other Contact").fill("student contact");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="username"]').fill(studentUsername);
  await page.locator('input[name="password"]').fill("Viewport123456!");
  await page.locator('input[name="confirmPassword"]').fill("Viewport123456!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await page.goto("/signup?role=teacher");
  await page.getByRole("button", { name: "Tutor" }).click();
  await page.locator('input[name="name"]').fill(teacherName);
  await page.getByLabel("Gender").fill("Female");
  await page.getByLabel("School").fill("Viewport School");
  await page.getByLabel("Grade").fill("College");
  await page
    .getByLabel("Standardized Scores (SAT/TOEFL, etc.)")
    .fill("TOEFL 110");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[name="username"]').fill(teacherUsername);
  await page.locator('input[name="password"]').fill("Viewport123456!");
  await page.locator('input[name="confirmPassword"]').fill("Viewport123456!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await page.getByRole("button", { name: "Signup Management" }).click();
  await expect(
    page.getByRole("heading", { name: "Pending Review" }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Approve ${studentName}` }).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Approve ${teacherName}` }).click();

  await page.getByRole("button", { name: "New pairing" }).click();
  const dialog = page.getByRole("dialog", { name: "New pairing" });
  await dialog
    .locator('select[name="studentProfileId"]')
    .selectOption({ label: `${studentName} · ${studentUsername}` });
  await dialog
    .locator('select[name="teacherProfileId"]')
    .selectOption({ label: `${teacherName} · ${teacherUsername}` });
  await dialog.getByRole("button", { name: "Create pairing" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("row", {
      name: new RegExp(`${studentName}.*${teacherName}`),
    }),
  ).toBeVisible();
});

test("teacher can sign in and see the seeded student dashboard data", async ({
  page,
}) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await expect(page.getByRole("heading", { name: "Week 01" })).toBeVisible();
  await expect(page.getByText("Demo Student")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save lesson" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Chinese" }),
  ).toBeVisible();

  const meetingLinkInput = page.getByRole("textbox", {
    name: "Tencent Meeting details",
  });
  await meetingLinkInput.fill("https://meeting.tencent.com/demo-room");
  await expect(meetingLinkInput).toHaveValue(
    "https://meeting.tencent.com/demo-room",
  );
  await page
    .getByRole("button", { name: "Save Tencent Meeting details" })
    .click();
});

test("teacher dialogs close with Escape and logout returns to the homepage", async ({
  page,
}) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  const guidelinesTrigger = page.getByRole("button", { name: "Guidelines" });
  await guidelinesTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Tutor guidelines" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Tutor guidelines" }),
  ).toHaveCount(0);
  await expect(guidelinesTrigger).toBeFocused();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "One-on-one online English support for children with rare diseases.",
    }),
  ).toBeVisible();
});

test("teacher sees a safe upload error when the lesson upload request fails", async ({
  page,
}) => {
  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Week 2 · Pending" }).click();
  await page.getByRole("button", { name: "Taught", exact: true }).click();
  await page
    .locator("#teacher-file-input")
    .setInputFiles("public/images/Rose.png");
  await page.route("**/api/uploads/lesson-evidence", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 500,
      body: JSON.stringify({
        error: {
          code: "LESSON_SAVE_FAILED",
          message: "Couldn't upload the lesson photo. Please try again.",
        },
      }),
    });
  });
  await page.getByRole("button", { name: "Save lesson" }).click();

  await expect(
    page.getByText("Couldn't upload the lesson photo. Please try again."),
  ).toBeVisible();
});

test("student can sign in and reach the learning path dashboard", async ({
  page,
}) => {
  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Tutee",
  });

  await expect(
    page.getByRole("heading", { name: "Your progress" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This week's lesson" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit feedback" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByRole("heading", { name: "我的进度" })).toBeVisible();
});

test("teacher can request a lesson time and the student can confirm it", async ({
  page,
}) => {
  const lessonDate = futureLessonDate();

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Calendar & booking" }).click();
  await page.getByLabel("Lesson time").fill(toTimeInputValue(lessonDate));
  await page.getByLabel("Duration").selectOption("60");
  await page.getByRole("button", { name: "Request time" }).click();
  await expect(page.getByText("Booking request sent.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Tutee",
  });

  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByText("Lesson time needs confirmation")).toBeVisible();
  await page.getByRole("button", { name: "Calendar & booking" }).click();
  await expect(page.getByText("Needs your confirmation").first()).toBeVisible();
  await expect(
    page.getByText(formatBookingDateText(lessonDate)).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Duration")).toHaveValue("60");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Booking updated.")).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Calendar & booking" }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await page.getByLabel("Reason").fill("Need to reschedule this lesson.");
  await page.getByRole("button", { name: "Request cancellation" }).click();
  await expect(page.getByText("Booking updated.")).toBeVisible();
  await expect(
    page
      .getByText("Waiting for the other side to confirm cancellation")
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/student",
    identifier: "demo_student",
    password: "demo123456",
    role: "Tutee",
  });

  await page.getByRole("button", { name: "Calendar & booking" }).click();
  await expect(
    page.getByText("Cancellation needs your confirmation").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByText("Booking updated.")).toBeVisible();
  await expect(page.getByText("Cancelled").first()).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  await page.getByRole("button", { name: "Booking Management" }).click();
  await expect(
    page.getByRole("row", { name: /Demo Student.*Demo Teacher/ }),
  ).toBeVisible();
  await expect(page.getByText("Cancelled").first()).toBeVisible();
  await expect(page.getByText("Need to reschedule this lesson.")).toBeVisible();
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
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Username").fill(username);
  await page.locator('input[name="password"]').fill("Rejected123456!");
  await page.locator('input[name="confirmPassword"]').fill("Rejected123456!");
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

  await page.getByRole("button", { name: "Signup Management" }).click();
  const declineButton = page.getByRole("button", {
    name: `Decline ${childName}`,
  });
  await expect(declineButton).toBeVisible();
  await declineButton.click();

  const rejectDialog = page.getByRole("dialog", {
    name: `Decline registration: ${childName}`,
  });
  await rejectDialog.getByLabel("Reason for declining").fill(rejectReason);
  await rejectDialog.getByRole("button", { name: "Confirm decline" }).click();

  await expect(
    page.getByRole("button", { name: `Decline ${childName}` }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/student",
    identifier: username,
    password: "Rejected123456!",
    role: "Tutee",
  });

  await expect(
    page.getByRole("heading", { name: "Registration not accepted" }),
  ).toBeVisible();
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

  await page.getByRole("button", { name: "Taught", exact: true }).click();
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

test("admin can open pairing details and read private weekly feedback without exposing it to the teacher view", async ({
  page,
}) => {
  const unique = Date.now().toString().slice(-6);
  const teacherNote = `Admin private note ${unique}`;
  const studentFeedback = `Admin private feedback ${unique}`;

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await page.getByRole("button", { name: "Week 2 · Pending" }).click();
  await page.getByRole("button", { name: "Taught", exact: true }).click();
  await page.getByLabel("Lesson notes").fill(teacherNote);
  await page.getByLabel("Who can see this note").selectOption("private");
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

  await page.getByRole("button", { name: "Week 2 · T" }).click();
  await page.getByLabel("Your feedback").fill(studentFeedback);
  await page.getByLabel("Who can see this").selectOption("private");
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.getByText("Feedback saved.")).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/admin",
    identifier: "admin",
    loginPath: "/admin/login",
    password: "playwright-admin-secret-2026",
    role: "Admin",
  });

  const pairingRow = page.locator("tr", { hasText: "Demo Student" });
  await pairingRow.getByRole("button", { name: "View details" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Student · Demo Teacher" }),
  ).toBeVisible();
  await expect(page.getByText(studentFeedback)).toBeVisible();
  await expect(page.getByText(teacherNote)).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, {
    dashboardPath: "/teacher",
    identifier: "demo_teacher",
    password: "demo123456",
    role: "Tutor",
  });

  await expect(page.getByText(studentFeedback)).toHaveCount(0);
});
