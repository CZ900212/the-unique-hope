const fs = require("node:fs");
const path = require("node:path");

const SMALL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7k4sAAAAASUVORK5CYII=";

function formatError(error) {
  if (!error) return "Unknown error";
  return error.stack || error.message || String(error);
}

function firstLine(value) {
  return String(value || "").split("\n")[0];
}

function shouldIgnoreRequestFailure(request) {
  const failureText = request.failure()?.errorText || "";
  return failureText === "net::ERR_ABORTED" && request.resourceType() === "image";
}

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    throw new Error(
      "Missing Playwright dependency. Run `npm install` in the repo root, then retry."
    );
  }
}

function detectChromeExecutable() {
  const candidates = [
    process.env.QA_BROWSER_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function launchChromium(playwright, headed) {
  const { chromium } = playwright;
  const executablePath = detectChromeExecutable();

  try {
    return await chromium.launch(
      executablePath
        ? { headless: !headed, executablePath }
        : { headless: !headed }
    );
  } catch (error) {
    throw new Error(
      [
        "Unable to launch Chromium for QA smoke tests.",
        executablePath
          ? `Tried browser executable: ${executablePath}`
          : "No local Chrome/Chromium executable found and no bundled Playwright browser is installed.",
        "Install a browser with `npx playwright install chromium`, or set `QA_BROWSER_PATH`."
      ].join(" ")
    );
  }
}

function attachDiagnostics(page, diagnostics) {
  page.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      diagnostics.console.push(`${type}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(formatError(error));
  });

  page.on("requestfailed", (request) => {
    if (shouldIgnoreRequestFailure(request)) {
      return;
    }
    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()} :: ${request.failure()?.errorText || "request failed"}`
    );
  });
}

async function waitForToast(page, matcher, timeout = 8000) {
  const locator = page.locator("#toast-container .toast");
  await locator.last().waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    ({ expression }) => {
      const nodes = [...document.querySelectorAll("#toast-container .toast")];
      return nodes.some((node) => new RegExp(expression, "i").test(node.textContent || ""));
    },
    { expression: matcher.source },
    { timeout }
  );
}

async function recordStep(results, screenshotsDir, name, page, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      status: "passed",
      durationMs: Date.now() - start
    });
  } catch (error) {
    const fileName = `${results.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    const screenshotPath = path.join(screenshotsDir, fileName);
    try {
      if (page) {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
    } catch {
      // best effort only
    }

    results.push({
      name,
      status: "failed",
      durationMs: Date.now() - start,
      error: formatError(error),
      screenshotPath
    });
    throw error;
  }
}

async function expectRedirectToLogin(page, baseUrl, protectedPath) {
  await page.goto(`${baseUrl}${protectedPath}`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login\.html$/);
}

async function loginAs(page, baseUrl, account) {
  await page.goto(`${baseUrl}/login.html`, { waitUntil: "networkidle" });
  await page.locator(`.tab[data-role="${account.role}"]`).click();
  await page.fill("#identifier", account.identifier);
  await page.fill("#password", account.password);
  await page.click("#loginBtn");
}

async function runLocalBrowserSmoke({ baseUrl, credentials, reportDir, headed = false }) {
  const playwright = await loadPlaywright();
  const browser = await launchChromium(playwright, headed);
  const screenshotsDir = path.join(reportDir, "screenshots");
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const diagnostics = {
    console: [],
    pageErrors: [],
    requestFailures: []
  };
  const results = [];

  try {
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    attachDiagnostics(anonymousPage, diagnostics);

    await recordStep(results, screenshotsDir, "public-home-and-i18n", anonymousPage, async () => {
      await anonymousPage.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
      await anonymousPage.locator("body").waitFor();
      await anonymousPage.locator('[data-i18n="nav.switchLang"]').first().click();
      await anonymousPage.waitForFunction(() => {
        const memberLogin = document.querySelector('[data-i18n="nav.memberLogin"]');
        return /会员登录/.test(memberLogin?.textContent || "");
      });
      await anonymousPage.click('a[href="login.html"]');
      await anonymousPage.waitForURL(/\/login\.html$/);
      await anonymousPage.waitForFunction(() => {
        const subtitle = document.querySelector('[data-i18n="login.subtitle"]');
        return /登录以继续您的旅程/.test(subtitle?.textContent || "");
      });
    });

    await recordStep(results, screenshotsDir, "public-signup", anonymousPage, async () => {
      await anonymousPage.goto(`${baseUrl}/signup.html`, { waitUntil: "networkidle" });
      await anonymousPage.fill("#childName", "QA Local Signup");
      await anonymousPage.fill("#age", "8");
      await anonymousPage.fill("#phone", "13812345678");
      await anonymousPage.fill("#contact", "wechat-qa-local");
      await anonymousPage.click("#submitBtn");
      await waitForToast(anonymousPage, /signup submitted|报名已提交/);
    });

    await recordStep(results, screenshotsDir, "unauthenticated-redirect", anonymousPage, async () => {
      await expectRedirectToLogin(anonymousPage, baseUrl, "/student.html");
    });

    await recordStep(results, screenshotsDir, "auth-invalid-password-and-role", anonymousPage, async () => {
      await anonymousPage.goto(`${baseUrl}/login.html`, { waitUntil: "networkidle" });
      await anonymousPage.locator('.tab[data-role="teacher"]').click();
      await anonymousPage.fill("#identifier", credentials.teacher.identifier);
      await anonymousPage.fill("#password", "wrong-password");
      await anonymousPage.click("#loginBtn");
      await waitForToast(anonymousPage, /invalid credentials/i);

      await anonymousPage.fill("#identifier", credentials.teacher.identifier);
      await anonymousPage.fill("#password", credentials.teacher.password);
      await anonymousPage.locator('.tab[data-role="student"]').click();
      await anonymousPage.click("#loginBtn");
      await waitForToast(anonymousPage, /role mismatch/i);
    });

    await anonymousContext.close();

    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    attachDiagnostics(teacherPage, diagnostics);

    await recordStep(results, screenshotsDir, "teacher-flow", teacherPage, async () => {
      await loginAs(teacherPage, baseUrl, credentials.teacher);
      await teacherPage.waitForURL(/\/teacher\.html$/);
      await teacherPage.waitForFunction(() => {
        const sidebar = document.querySelector('[data-i18n="teacher.sidebarLessons"]');
        return /Weekly Lessons/.test(sidebar?.textContent || "");
      });
      await teacherPage.locator('[data-i18n="nav.switchLang"]').click();
      await teacherPage.waitForFunction(() => {
        const sidebar = document.querySelector('[data-i18n="teacher.sidebarLessons"]');
        return /每周课程/.test(sidebar?.textContent || "");
      });

      await teacherPage.locator("#weekList button").nth(1).click();
      await teacherPage.locator('[data-i18n="teacher.btnTaught"]').click();
      await teacherPage.fill("#notes", "QA shared lesson note");
      await teacherPage.selectOption("#notesVisibility", "shared");
      await teacherPage.setInputFiles("#fileInput", {
        name: "lesson-proof.png",
        mimeType: "image/png",
        buffer: Buffer.from(SMALL_PNG_BASE64, "base64")
      });
      await teacherPage.click("#saveBtn");
      await waitForToast(teacherPage, /lesson saved|课程已保存/);
      await teacherPage.reload({ waitUntil: "networkidle" });
      await teacherPage.locator("#weekList button").nth(1).click();
      await teacherPage.waitForFunction(() => {
        const notes = document.getElementById("notes");
        const preview = document.getElementById("preview");
        return notes?.value === "QA shared lesson note" && preview?.style.display !== "none";
      });
      await teacherPage.locator('[data-i18n="nav.logout"]').click();
      await teacherPage.waitForURL(/\/login\.html$/);
    });

    await teacherContext.close();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    attachDiagnostics(studentPage, diagnostics);

    await recordStep(results, screenshotsDir, "student-flow", studentPage, async () => {
      await loginAs(studentPage, baseUrl, credentials.student);
      await studentPage.waitForURL(/\/student\.html$/);
      await studentPage.waitForFunction(() => {
        const heading = document.querySelector('[data-i18n="student.dashTitle"]');
        return /Learning Path/.test(heading?.textContent || "");
      });
      await studentPage.locator('[data-i18n="nav.switchLang"]').click();
      await studentPage.waitForFunction(() => {
        const heading = document.querySelector('[data-i18n="student.dashTitle"]');
        return /学习路径/.test(heading?.textContent || "");
      });
      await studentPage.reload({ waitUntil: "networkidle" });
      await studentPage.waitForFunction(() => {
        const heading = document.querySelector('[data-i18n="student.dashTitle"]');
        return /学习路径/.test(heading?.textContent || "");
      });

      await studentPage.locator("#weekList button").nth(1).click();
      await studentPage.waitForFunction(() => {
        const notes = document.getElementById("notesContent");
        const image = document.getElementById("evidenceImg");
        return /QA shared lesson note/.test(notes?.textContent || "") && image?.style.display !== "none";
      });
      await studentPage.fill("#feedback", "QA student feedback");
      await studentPage.selectOption("#feedbackRating", "5");
      await studentPage.selectOption("#feedbackVisibility", "shared");
      await studentPage.click("#saveFeedbackBtn");
      await waitForToast(studentPage, /feedback submitted|反馈已提交/);
      await studentPage.reload({ waitUntil: "networkidle" });
      await studentPage.locator("#weekList button").nth(1).click();
      await studentPage.waitForFunction(() => {
        const feedback = document.getElementById("feedback");
        return feedback?.value === "QA student feedback";
      });
      await studentPage.locator('[data-i18n="nav.logout"]').click();
      await studentPage.waitForURL(/\/login\.html$/);
    });

    await studentContext.close();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    attachDiagnostics(adminPage, diagnostics);

    await recordStep(results, screenshotsDir, "admin-flow", adminPage, async () => {
      await loginAs(adminPage, baseUrl, credentials.admin);
      await adminPage.waitForURL(/\/admin\.html$/);
      await adminPage.waitForFunction(() => {
        const title = document.querySelector('[data-i18n="admin.managePairings"]');
        return /Manage Pairings/.test(title?.textContent || "");
      });
      await adminPage.locator('[data-i18n="nav.switchLang"]').click();
      await adminPage.waitForFunction(() => {
        const title = document.querySelector('[data-i18n="admin.managePairings"]');
        return /管理配对/.test(title?.textContent || "");
      });

      const pageInfo = adminPage.locator("#pageInfo");
      await pageInfo.waitFor();
      await adminPage.waitForFunction(() => document.getElementById("pageInfo")?.textContent?.includes("1 / 2"));
      await adminPage.click("#nextPageBtn");
      await adminPage.waitForFunction(() => document.getElementById("pageInfo")?.textContent?.includes("2 / 2"));
      await adminPage.click("#prevPageBtn");
      await adminPage.fill("#searchInput", "qa_student");
      await adminPage.waitForFunction(() => {
        const rows = [...document.querySelectorAll("#pairingsTable tbody tr")];
        return rows.length === 1 && /qa_student/i.test(rows[0].textContent || "");
      });
      await adminPage.fill("#searchInput", "");

      await adminPage.click('button[data-i18n="admin.newPairing"]');
      const uniqueSuffix = String(Date.now()).slice(-6);
      const studentUsername = `temp_student_${uniqueSuffix}`;
      const teacherUsername = `temp_teacher_${uniqueSuffix}`;
      await adminPage.fill("#sName", `Temp Student ${uniqueSuffix}`);
      await adminPage.fill("#sContact", "temp-contact");
      await adminPage.fill("#sUser", studentUsername);
      await adminPage.fill("#sEmail", `temp-student-${uniqueSuffix}@example.com`);
      await adminPage.fill("#sPass", "temp-pass-123");
      await adminPage.fill("#tName", `Temp Teacher ${uniqueSuffix}`);
      await adminPage.fill("#tUser", teacherUsername);
      await adminPage.fill("#tEmail", `temp-teacher-${uniqueSuffix}@example.com`);
      await adminPage.fill("#tPass", "temp-pass-123");
      await adminPage.click('#entryForm button[type="submit"]');
      await adminPage.waitForFunction(
        ({ username }) => {
          return [...document.querySelectorAll("#pairingsTable tbody tr")].some((row) =>
            (row.textContent || "").toLowerCase().includes(username)
          );
        },
        { username: studentUsername }
      );

      adminPage.once("dialog", (dialog) => dialog.accept());
      await adminPage.fill("#searchInput", studentUsername);
      await adminPage.locator("#pairingsTable tbody .btn-danger").first().click();
      await adminPage.waitForFunction(
        ({ username }) => {
          return ![...document.querySelectorAll("#pairingsTable tbody tr")].some((row) =>
            (row.textContent || "").toLowerCase().includes(username)
          );
        },
        { username: studentUsername }
      );
      await adminPage.fill("#searchInput", "");

      await adminPage.locator('[data-i18n="admin.menuSignups"]').click();
      const signupRow = adminPage.locator("#signupsTable tbody tr").filter({ hasText: "QA Local Signup" }).first();
      await signupRow.waitFor();
      await signupRow.locator("button").first().click();
      await adminPage.waitForFunction(() => {
        const rows = [...document.querySelectorAll("#signupsTable tbody tr")];
        return rows.some((row) => /QA Local Signup/.test(row.textContent || "") && row.querySelectorAll("button").length === 0);
      });

      const rejectRow = adminPage.locator("#signupsTable tbody tr").filter({ hasText: "QA Reject Candidate" }).first();
      await rejectRow.locator("button").nth(1).click();
      await adminPage.click('[data-i18n="admin.signupConfirmReject"]');
      await waitForToast(adminPage, /rejection reason|拒绝原因/);
      await adminPage.fill("#rejectReasonInput", "QA rejection reason");
      await adminPage.click('[data-i18n="admin.signupConfirmReject"]');
      await adminPage.waitForFunction(() => {
        const rows = [...document.querySelectorAll("#signupsTable tbody tr")];
        return rows.some((row) => /QA Reject Candidate/.test(row.textContent || "") && /QA rejection reason/.test(row.textContent || ""));
      });

      await adminPage.locator('[data-i18n="nav.logout"]').click();
      await adminPage.waitForURL(/\/login\.html$/);
    });

    await adminContext.close();

    return {
      results,
      diagnostics: {
        console: [...new Set(diagnostics.console)],
        pageErrors: [...new Set(diagnostics.pageErrors)],
        requestFailures: [...new Set(diagnostics.requestFailures)]
      }
    };
  } finally {
    await browser.close();
  }
}

module.exports = { runLocalBrowserSmoke, firstLine };
